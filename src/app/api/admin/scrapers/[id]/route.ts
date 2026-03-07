/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

async function checkAdmin(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'ADMIN') return null;
  return payload;
}

// PUT — update scraper config
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const config = await prisma.scraperConfig.update({
    where: { id },
    data: {
      name: body.name,
      isEnabled: body.isEnabled,
      config: body.config,
      schedule: body.schedule,
      type: body.type,
    },
  });

  return NextResponse.json({ config });
}

// DELETE — delete scraper config + all its jobs
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await checkAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Stop any running jobs first
  const runningJobs = await prisma.scraperJob.findMany({
    where: { configId: id, status: 'RUNNING' },
  });
  for (const job of runningJobs) {
    if (job.pid) {
      try { process.kill(job.pid, 'SIGKILL'); } catch {}
    }
  }

  await prisma.scraperJob.deleteMany({ where: { configId: id } });
  await prisma.scraperConfig.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
