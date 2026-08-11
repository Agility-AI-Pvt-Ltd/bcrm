import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";

const properties = [
  {
    title: "Skyline Residency",
    location: "Whitefield, Bengaluru",
    type: "3 BHK Apartment",
    price: "₹1.2 Cr",
    status: "Available",
  },
  {
    title: "Green Valley Villa",
    location: "Sarjapur Road",
    type: "4 BHK Villa",
    price: "₹2.6 Cr",
    status: "Available",
  },
  {
    title: "Metro Heights",
    location: "Electronic City",
    type: "2 BHK Apartment",
    price: "₹78 L",
    status: "Reserved",
  },
  {
    title: "Lakeview Enclave",
    location: "Hebbal",
    type: "3 BHK Apartment",
    price: "₹1.5 Cr",
    status: "Sold",
  },
  {
    title: "Urban Crest",
    location: "Indiranagar",
    type: "Penthouse",
    price: "₹4.1 Cr",
    status: "Available",
  },
];

export default function PropertiesPage() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Properties" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          ["36", "Active listings"],
          ["12", "New this month"],
          ["8", "Reserved"],
          ["5", "Sold this quarter"],
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
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              Property inventory
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Listings you can promote in campaigns.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Add property
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {properties.map((property) => (
                <tr key={property.title}>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                    {property.title}
                  </td>
                  <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                    {property.location}
                  </td>
                  <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                    {property.type}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                    {property.price}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      color={
                        property.status === "Available"
                          ? "success"
                          : property.status === "Reserved"
                            ? "warning"
                            : "dark"
                      }
                      size="sm"
                    >
                      {property.status}
                    </Badge>
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
