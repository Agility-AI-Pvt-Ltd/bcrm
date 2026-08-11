import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";

type LeadStatus = "New" | "Contacted" | "Qualified" | "Site visit" | "Negotiation";

const leads: {
  name: string;
  property: string;
  budget: string;
  status: LeadStatus;
  lastContact: string;
}[] = [
  {
    name: "Ananya Sharma",
    property: "Whitefield 3BHK",
    budget: "₹1.2 Cr",
    status: "New",
    lastContact: "Today",
  },
  {
    name: "Vikram Singh",
    property: "Indiranagar Villa",
    budget: "₹2.8 Cr",
    status: "Contacted",
    lastContact: "Yesterday",
  },
  {
    name: "Meera Iyer",
    property: "Sarjapur Plot",
    budget: "₹95 L",
    status: "Qualified",
    lastContact: "2 days ago",
  },
  {
    name: "Karan Desai",
    property: "Electronic City 2BHK",
    budget: "₹78 L",
    status: "Site visit",
    lastContact: "3 days ago",
  },
  {
    name: "Divya Menon",
    property: "Hebbal Apartment",
    budget: "₹1.5 Cr",
    status: "Negotiation",
    lastContact: "1 week ago",
  },
];

const statusColor: Record<LeadStatus, "info" | "warning" | "primary" | "success" | "dark"> = {
  New: "info",
  Contacted: "warning",
  Qualified: "primary",
  "Site visit": "success",
  Negotiation: "dark",
};

export default function LeadsPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Leads" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          ["248", "Total leads"],
          ["64", "New this week"],
          ["42", "Qualified"],
          ["18", "Site visits booked"],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white/90">Lead pipeline</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track buyer interest from first reply to site visit.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Lead</th>
                <th className="px-5 py-3 font-medium">Interested property</th>
                <th className="px-5 py-3 font-medium">Budget</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Last contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {leads.map((lead) => (
                <tr key={lead.name}>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                    {lead.name}
                  </td>
                  <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                    {lead.property}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                    {lead.budget}
                  </td>
                  <td className="px-5 py-4">
                    <Badge color={statusColor[lead.status]} size="sm">
                      {lead.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                    {lead.lastContact}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
