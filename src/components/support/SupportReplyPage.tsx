import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";

const thread = [
  {
    author: "John Doe",
    email: "jhondelin@gmail.com",
    time: "Mon, 3:20 PM (2 hrs ago)",
    body: "I’m currently working on customizing the EstateAdmin dashboard and would like to add a new section labeled “Reports.” Before I proceed, I wanted to check if there’s any official guide or best practice you recommend for adding custom pages within the EstateAdmin structure.",
  },
  {
    author: "Musharof Chowdhury",
    email: "From - support team",
    time: "Mon, 3:20 PM (2 hrs ago)",
    body: "Yes, you can add custom pages like a Reports section. Update the sidebar configuration, add a route under src/app/(admin), and keep the page inside the admin layout shell.",
  },
];

export default function SupportReplyPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Support Reply" />

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-8 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="mb-6 border-b border-gray-100 pb-4 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Ticket #346520 - Sidebar not responsive on mobile
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Mon, 3:20 PM (2 days ago)
            </p>
          </div>

          <div className="space-y-5">
            {thread.map((message) => (
              <article
                key={`${message.author}-${message.time}`}
                className="rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {message.author}
                    </p>
                    <p className="text-sm text-gray-500">{message.email}</p>
                  </div>
                  <p className="text-xs text-gray-400">{message.time}</p>
                </div>
                <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {message.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reply
            </label>
            <textarea
              className="h-32 w-full resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
              placeholder="Write your reply..."
              defaultValue=""
            />
            <button
              type="button"
              className="mt-3 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Send Reply
            </button>
          </div>
        </section>

        <aside className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <h3 className="mb-4 font-semibold text-gray-800 dark:text-white/90">
            Ticket Details
          </h3>
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Status</dt>
              <dd>
                <Badge color="warning" size="sm">
                  In Progress
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Customer</dt>
              <dd className="font-medium text-gray-800 dark:text-white/90">John Doe</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="text-gray-700 dark:text-gray-300">jhondelin@gmail.com</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Ticket ID</dt>
              <dd className="font-medium text-gray-800 dark:text-white/90">#346520</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Category</dt>
              <dd className="text-gray-700 dark:text-gray-300">General Support</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-700 dark:text-gray-300">Dec 20, 2028</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
