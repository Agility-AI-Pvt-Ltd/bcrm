import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";

export default function InboxDetailsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Inbox Details" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">
              Contact For “Website Design”
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Codescandy · hello@example.com
            </p>
          </div>
          <Link
            href="/inbox"
            className="text-sm font-medium text-brand-500 hover:text-brand-600"
          >
            Back to Inbox
          </Link>
        </div>

        <div className="space-y-4 px-5 py-6 text-sm leading-6 text-gray-600 dark:text-gray-300">
          <p>Hello Dear Alexander,</p>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent ut
            rutrum mi. Aenean ac leo non justo suscipit consectetur. Nam vestibulum
            eleifend magna quis porta.
          </p>
          <p>
            Nullam tincidunt sodales diam, quis rhoncus dolor aliquet a. Nulla a
            rhoncus lectus. In nunc neque, pellentesque non massa ornare, accumsan
            ornare massa.
          </p>
          <p>
            Suspendisse semper vel turpis vitae aliquam. Aenean semper dui in
            consequat ullamcorper.
          </p>
        </div>

        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="mb-3 text-sm font-medium text-gray-800 dark:text-white/90">
            2 Attachments
          </p>
          <div className="flex flex-wrap gap-3">
            {["Guidelines.pdf", "Branding Assets"].map((file) => (
              <div
                key={file}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-700"
              >
                <p className="font-medium text-gray-800 dark:text-white/90">{file}</p>
                <button
                  type="button"
                  className="mt-1 text-xs font-medium text-brand-500"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          {["Reply", "Reply all", "Forward"].map((action) => (
            <button
              key={action}
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
