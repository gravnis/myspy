export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-gray-600 mb-4">Last updated: March 2026</p>

      <div className="space-y-4 text-gray-700">
        <p>
          MySpy (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) operates the MySpy web application.
          This page informs you of our policies regarding the collection, use, and disclosure of personal data.
        </p>

        <h2 className="text-xl font-semibold mt-6">Data We Collect</h2>
        <p>We collect your email address and name when you register an account.</p>

        <h2 className="text-xl font-semibold mt-6">How We Use Data</h2>
        <p>Your data is used solely to provide the MySpy service — authentication and personalization of your experience.</p>

        <h2 className="text-xl font-semibold mt-6">Third-Party Services</h2>
        <p>We use the Meta Ad Library API to retrieve publicly available advertising data. No personal user data is shared with Meta.</p>

        <h2 className="text-xl font-semibold mt-6">Contact</h2>
        <p>For any questions, contact us at admin@myspy.com.</p>
      </div>
    </div>
  );
}
