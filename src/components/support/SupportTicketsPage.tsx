"use client";

import Link from "next/link";
import { useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";

const tickets = [
  {
    id: "#323534",
    name: "Lindsey Curtis",
    email: "demoemail@gmail.com",
    subject: "Issue with Dashboard Login Access",
    date: "12 Feb, 2027",
    status: "Solved",
  },
  {
    id: "#323535",
    name: "Kaiya George",
    email: "demoemail@gmail.com",
    subject: "Billing Information Not Updating Properly",
    date: "13 Mar, 2027",
    status: "Pending",
  },
  {
    id: "#323536",
    name: "Zain Geidt",
    email: "demoemail@gmail.com",
    subject: "Bug Found in Dark Mode Layout",
    date: "19 Mar, 2027",
    status: "Pending",
  },
  {
    id: "#323537",
    name: "Abram Schleifer",
    email: "demoemail@gmail.com",
    subject: "Request to Add New Integration Feature",
    date: "25 Apr, 2027",
    status: "Solved",
  },
  {
    id: "#323538",
    name: "Mia Chen",
    email: "mia.chen@email.com",
    subject: "Unable to Reset Password",
    date: "28 Apr, 2027",
    status: "Pending",
  },
];

export default function SupportTicketsPage() {
  const [filter, setFilter] = useState<"All" | "Solved" | "Pending">("All");
  const filtered =
    filter === "All" ? tickets : tickets.filter((ticket) => ticket.status === filter);

  return (
    <div>
      <PageBreadcrumb pageTitle="Support List" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          ["5,347", "Total tickets"],
          ["1,230", "Pending tickets"],
          ["4,117", "Solved tickets"],
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

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-col gap-4 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white/90">
              Support Tickets
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your most recent support tickets list
            </p>
          </div>
          <div className="flex gap-2">
            {(["All", "Solved", "Pending"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  filter === item
                    ? "bg-brand-500 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-white/[0.05] dark:text-gray-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Ticket ID</th>
                <th className="px-5 py-3 font-medium">Requested By</th>
                <th className="px-5 py-3 font-medium">Subject</th>
                <th className="px-5 py-3 font-medium">Create Date</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                    {ticket.id}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {ticket.name}
                    </p>
                    <p className="text-xs text-gray-500">{ticket.email}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                    {ticket.subject}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-gray-500">
                    {ticket.date}
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      color={ticket.status === "Solved" ? "success" : "warning"}
                      size="sm"
                    >
                      {ticket.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href="/support-ticket-reply"
                      className="text-sm font-medium text-brand-500 hover:text-brand-600"
                    >
                      View More
                    </Link>
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
