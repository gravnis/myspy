export default function DataDeletionPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <h1 className="text-3xl font-bold mb-6">Data Deletion Request</h1>
      <p className="text-gray-600 mb-4">Last updated: March 2026</p>

      <div className="space-y-4 text-gray-700">
        <p>
          If you wish to delete your account and all associated data from MySpy,
          please send an email to <strong>admin@myspy.com</strong> with the subject
          line &quot;Data Deletion Request&quot;.
        </p>

        <p>We will process your request within 30 days and delete:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your account information (email, name)</li>
          <li>Your saved projects and collections</li>
          <li>Any AI-generated creatives associated with your account</li>
        </ul>

        <p>
          After deletion, your data cannot be recovered. You will receive a
          confirmation email once the deletion is complete.
        </p>

        <h2 className="text-xl font-semibold mt-6">Contact</h2>
        <p>Email: admin@myspy.com</p>
      </div>
    </div>
  );
}
