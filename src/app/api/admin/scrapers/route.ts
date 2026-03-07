/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { spawn } from 'child_process';

async function checkAdmin(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return null;
  return payload;
}

// GET — list all scraper configs + recent jobs + live status
export async function GET(request: NextRequest) {
  const admin = await checkAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const configs = await prisma.scraperConfig.findMany({
    include: { jobs: { orderBy: { startedAt: 'desc' }, take: 5 } },
    orderBy: { createdAt: 'asc' },
  });

  // Check if running jobs are actually alive (PID check)
  for (const config of configs) {
    for (const job of config.jobs) {
      if (job.status === 'RUNNING' && job.pid) {
        try {
          process.kill(job.pid, 0); // check if alive
        } catch {
          // Process is dead, mark as error
          await prisma.scraperJob.update({
            where: { id: job.id },
            data: { status: 'ERROR', completedAt: new Date(), errorMessage: 'Process died unexpectedly' },
          });
          job.status = 'ERROR';
          job.errorMessage = 'Process died unexpectedly';
        }
      }
    }
  }

  // Recent jobs across all scrapers
  const recentJobs = await prisma.scraperJob.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
  });

  // Stats
  const totalJobs = await prisma.scraperJob.count();
  const runningJobs = await prisma.scraperJob.count({ where: { status: 'RUNNING' } });
  const totalAdsScraped = await prisma.scraperJob.aggregate({ _sum: { adsNew: true } });
  const totalUnitsUsed = await prisma.scraperJob.aggregate({ _sum: { unitsUsed: true } });

  return NextResponse.json({
    configs,
    recentJobs,
    stats: {
      totalJobs,
      runningJobs,
      totalAdsScraped: totalAdsScraped._sum.adsNew || 0,
      totalUnitsUsed: totalUnitsUsed._sum.unitsUsed || 0,
    },
  });
}

// POST — create config OR start a scraper job
export async function POST(request: NextRequest) {
  const admin = await checkAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();

  // Create new scraper config
  if (body.action === 'create_config') {
    const config = await prisma.scraperConfig.create({
      data: {
        type: body.type || 'GRAPHQL',
        name: body.name || 'New Scraper',
        isEnabled: body.isEnabled ?? false,
        config: body.config || {},
        schedule: body.schedule || 'manual',
      },
    });
    return NextResponse.json({ config });
  }

  // Start a scraper job
  if (body.action === 'start') {
    const configId = body.configId;
    const config = configId ? await prisma.scraperConfig.findUnique({ where: { id: configId } }) : null;

    // Check if already running
    if (configId) {
      const running = await prisma.scraperJob.findFirst({
        where: { configId, status: 'RUNNING' },
      });
      if (running) {
        return NextResponse.json({ error: 'Already running', job: running }, { status: 409 });
      }
    }

    const type = body.type || config?.type || 'GRAPHQL';
    const jobConfig = body.config || (config?.config as any) || {};

    // Determine script and args
    let script: string;
    let args: string[];

    if (type === 'GRAPHQL') {
      script = 'scripts/scrape-graphql.ts';
      args = [
        jobConfig.keyword || 'casino',
        jobConfig.country || 'US',
        String(jobConfig.maxAds || 500),
      ];
    } else if (type === 'BROWSERLESS') {
      script = 'scripts/scrape-browserless.ts';
      args = [String(jobConfig.maxCombos || 30)];
    } else {
      script = 'scripts/scrape.ts';
      args = [];
      if (jobConfig.maxCombos) {
        // Set env var
      }
    }

    // Create job record first
    const job = await prisma.scraperJob.create({
      data: {
        configId: configId || undefined,
        type: type as any,
        status: 'RUNNING',
        config: jobConfig,
      },
    });

    // Spawn process
    try {
      const child = spawn('npx', ['tsx', script, ...args], {
        cwd: process.cwd(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          SCRAPER_JOB_ID: job.id,
        },
      });

      child.unref();

      // Update job with PID
      await prisma.scraperJob.update({
        where: { id: job.id },
        data: { pid: child.pid },
      });

      // Collect output in background
      let output = '';
      child.stdout?.on('data', (data) => {
        output += data.toString();
        // Parse progress from output
        const lines = output.split('\n');
        const lastProgress = lines.filter(l => l.includes('total:')).pop();
        if (lastProgress) {
          const totalMatch = lastProgress.match(/total:\s*(\d+)/);
          const newMatch = lastProgress.match(/(\d+)\s*new/);
          const updMatch = lastProgress.match(/(\d+)\s*upd/);
          const sessionMatch = lastProgress.match(/Session\s*(\d+)/i) || output.match(/(\d+)\s*units/i);

          prisma.scraperJob.update({
            where: { id: job.id },
            data: {
              adsFound: totalMatch ? parseInt(totalMatch[1]) : undefined,
              adsNew: newMatch ? parseInt(newMatch[1]) : undefined,
              adsUpdated: updMatch ? parseInt(updMatch[1]) : undefined,
              unitsUsed: sessionMatch ? parseInt(sessionMatch[1]) : undefined,
              progress: { lastOutput: lines.slice(-5).join('\n') },
            },
          }).catch(() => {});
        }
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('exit', (code) => {
        const finalLines = output.split('\n').filter(Boolean);
        const lastLine = finalLines[finalLines.length - 1] || '';

        // Parse final stats
        const newMatch = lastLine.match(/(\d+)\s*new/);
        const updMatch = lastLine.match(/(\d+)\s*updated/);
        const unitsMatch = lastLine.match(/(\d+)\s*units/);

        prisma.scraperJob.update({
          where: { id: job.id },
          data: {
            status: code === 0 ? 'COMPLETED' : 'ERROR',
            completedAt: new Date(),
            adsNew: newMatch ? parseInt(newMatch[1]) : undefined,
            adsUpdated: updMatch ? parseInt(updMatch[1]) : undefined,
            unitsUsed: unitsMatch ? parseInt(unitsMatch[1]) : undefined,
            errorMessage: code !== 0 ? `Exit code: ${code}` : undefined,
            progress: { output: finalLines.slice(-20).join('\n') },
          },
        }).catch(() => {});

        // Update config lastRunAt
        if (configId) {
          prisma.scraperConfig.update({
            where: { id: configId },
            data: { lastRunAt: new Date() },
          }).catch(() => {});
        }
      });

      return NextResponse.json({ job: { ...job, pid: child.pid } });
    } catch (err: any) {
      await prisma.scraperJob.update({
        where: { id: job.id },
        data: { status: 'ERROR', errorMessage: err.message, completedAt: new Date() },
      });
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Stop a job
  if (body.action === 'stop') {
    const jobId = body.jobId;
    const job = await prisma.scraperJob.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (job.pid) {
      try {
        process.kill(job.pid, 'SIGTERM');
        // Give it 2s, then SIGKILL
        setTimeout(() => {
          try { process.kill(job.pid!, 'SIGKILL'); } catch {}
        }, 2000);
      } catch {}
    }

    await prisma.scraperJob.update({
      where: { id: jobId },
      data: { status: 'STOPPED', completedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
