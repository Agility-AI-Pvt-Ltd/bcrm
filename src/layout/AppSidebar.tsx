"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BellIcon,
  BoxCubeIcon,
  CalenderIcon,
  ChatIcon,
  ChevronDownIcon,
  GridIcon,
  HomeIcon,
  HorizontaLDots,
  MapPinIcon,
  PaperPlaneIcon,
  PhoneCallIcon,
  PieChartIcon,
  PlugInIcon,
  ShootingStarIcon,
  TimeIcon,
  UserCircleIcon,
} from "../icons/index";
import { useStoredUser } from "@/hooks/useStoredUser";
import { isAwaitingVerification } from "@/lib/access";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  new?: boolean;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  // Home is the leads list, and it is deliberately the first thing in the menu.
  // What brings people back to this app is a customer waiting on a reply, so the
  // fastest possible path to "who should I answer next" is the home they expect —
  // not a dashboard, and not two clicks down inside Campaign Studio.
  {
    icon: <HomeIcon />,
    name: "Home",
    path: "/leads",
  },
  // Inbox lives next to Home, not inside Campaign Studio: answering a customer
  // is daily work, not a campaign setup step.
  {
    icon: <ChatIcon />,
    name: "Messages",
    path: "/messages",
  },
  // Inventory, not a campaign step. Properties is looked at constantly — while
  // answering a customer, while building a campaign, while checking a price —
  // so it sits with the other daily-reference pages rather than one click down
  // inside a group about setting campaigns up.
  {
    icon: <BoxCubeIcon />,
    name: "Properties",
    path: "/properties",
  },
  {
    icon: <ShootingStarIcon />,
    name: "Campaign Studio",
    subItems: [
      { name: "WhatsApp Outreach", path: "/outreach", pro: false, new: true },
      { name: "Campaigns", path: "/campaigns", pro: false },
      { name: "Contacts", path: "/contacts", pro: false },
    ],
  },
  // Deliberately top-level, not inside Campaign Studio: notifications span every
  // campaign, and burying them a click deep defeats the point of a shortcut. The
  // bell matches the one in the header so both read as the same destination.
  {
    icon: <BellIcon />,
    name: "Notifications",
    path: "/notifications",
  },
  // Site visits are the one thing in this product that happens in the physical
  // world, and the day a broker has is organised around them — so they sit above
  // the calendar rather than inside it.
  {
    icon: <MapPinIcon />,
    name: "Site Visits",
    path: "/site-visits",
  },
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  // Not a campaign step either: a lead can go quiet weeks after the campaign
  // that first messaged it finished, and still needs following up. It runs on
  // its own schedule, so it gets its own entry rather than living under
  // Campaign Studio.
  {
    icon: <TimeIcon />,
    name: "Follow-ups",
    path: "/follow-ups",
  },
  // The one outbound AI call left: phoning WhatsApp enquiries that went quiet.
  // Top-level rather than inside Campaign Studio or the profile menu, because it
  // runs continuously on every new enquiry, not as part of a campaign.
  {
    icon: <PhoneCallIcon />,
    name: "AI Callback",
    path: "/ai-callback",
  },
  // The one message EstateFlow sends its own team rather than a customer: each
  // agent's morning summary, on their personal WhatsApp. Top-level because it is
  // the first thing a broker reads each day, and because the number it goes to is
  // set here — not buried in a settings tab.
  {
    icon: <PieChartIcon />,
    name: "Daily Digest",
    path: "/daily-digest",
  },
  // Approval status gates every message EstateFlow sends first — the digest, the
  // first touch, visit reminders. A pending template is a feature switched off, so
  // this is a destination of its own rather than a tab inside profile settings.
  {
    icon: <PaperPlaneIcon />,
    name: "WhatsApp Templates",
    path: "/whatsapp-templates",
  },
  // Where leads come from. Zoho CRM is the lead source of truth: the portals
  // feed Zoho, and EstateFlow keeps a synced copy.
  {
    icon: <PlugInIcon />,
    name: "Integrations",
    subItems: [{ name: "Zoho CRM", path: "/integrations/zoho", pro: false, new: true }],
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const awaitingVerification = isAwaitingVerification(useStoredUser());

  // Which group the current URL lives in. Derived during render instead of
  // pushed into state from an effect, so navigating costs one render, not two.
  const routeSubmenu = useMemo(() => {
    const index = navItems.findIndex((nav) =>
      nav.subItems?.some((subItem) => subItem.path === pathname),
    );
    return index === -1 ? null : index;
  }, [pathname]);

  // A click on a group header overrides the URL-derived choice, but only for as
  // long as we stay on the same page — storing the pathname alongside the
  // override is what lets the next navigation take back control without an effect.
  const [override, setOverride] = useState<{
    pathname: string;
    index: number | null;
  } | null>(null);

  const openIndex =
    override && override.pathname === pathname ? override.index : routeSubmenu;

  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>({});
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Exact match, or a child route of it. Properties now has `/properties/list`
  // behind its stat tiles, and an exact-only match left the menu unhighlighted
  // there — the user is plainly still in Properties. The trailing slash matters:
  // without it `/lead` would also light up on `/leads`.
  const isActive = useCallback(
    (path: string) => pathname === path || pathname.startsWith(`${path}/`),
    [pathname],
  );

  const handleSubmenuToggle = (index: number) => {
    setOverride({ pathname, index: openIndex === index ? null : index });
  };

  const renderMenuItems = (items: NavItem[]) => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index)}
              className={`menu-item group  ${
                openIndex === index ? "menu-item-active" : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openIndex === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="ml-auto flex items-center gap-2">
                  {nav.new && (
                    <span className="menu-dropdown-badge menu-dropdown-badge-inactive">
                      new
                    </span>
                  )}
                  <ChevronDownIcon
                    className={`w-5 h-5 transition-transform duration-200  ${
                      openIndex === index ? "rotate-180 text-brand-500" : ""
                    }`}
                  />
                </span>
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
                {(isExpanded || isHovered || isMobileOpen) && nav.new && (
                  <span className="ml-auto menu-dropdown-badge menu-dropdown-badge-inactive">
                    new
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[index] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openIndex === index ? `${subMenuHeight[index] ?? 0}px` : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  // Measuring the rendered submenu is a genuine read from the DOM, so it has to
  // happen after paint. Only the measured height lands in state, and only when it
  // actually changed, so this cannot loop.
  useEffect(() => {
    if (openIndex === null) return;
    const node = subMenuRefs.current[openIndex];
    if (!node) return;
    const measured = node.scrollHeight;
    setSubMenuHeight((previous) =>
      previous[openIndex] === measured
        ? previous
        : { ...previous, [openIndex]: measured },
    );
  }, [openIndex]);

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
              ? "w-[290px]"
              : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        {/* The brand mark is the other "take me home" gesture people try, so it goes
            where the Home menu item goes — the leads list — not to /campaigns. */}
        <Link href="/leads">
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
              <GridIcon className="h-5 w-5" />
            </span>
            {(isExpanded || isHovered || isMobileOpen) && (
              <span>
                <span className="block text-base font-semibold text-gray-900 dark:text-white">
                  EstateFlow
                </span>
                <span className="block text-xs text-gray-400">
                  AI campaign workspace
                </span>
              </span>
            )}
          </span>
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {awaitingVerification ? (
                /* Nothing in this menu is reachable until an operator verifies
                   the account, and `AuthGate` turns every one of these links
                   into a bounce back to /plans. Rendering them anyway would be
                   the app advertising doors that do not open. */
                isExpanded || isHovered || isMobileOpen ? (
                  <p className="rounded-lg bg-gray-50 px-3 py-4 text-xs leading-relaxed text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                    Your account is awaiting verification. The workspace unlocks
                    as soon as your payment is confirmed.
                  </p>
                ) : null
              ) : (
                renderMenuItems(navItems)
              )}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
