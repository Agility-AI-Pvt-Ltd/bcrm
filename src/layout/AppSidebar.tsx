"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import {
  BellIcon,
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HomeIcon,
  HorizontaLDots,
  ShootingStarIcon,
  UserCircleIcon,
} from "../icons/index";

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
  {
    icon: <ShootingStarIcon />,
    name: "Campaign Studio",
    subItems: [
      { name: "WhatsApp Outreach", path: "/outreach", pro: false, new: true },
      { name: "AI Calling", path: "/calls", pro: false, new: true },
      { name: "Messages", path: "/messages", pro: false, new: true },
      { name: "Lead Pipeline", path: "/pipeline", pro: false, new: true },
      { name: "Campaigns", path: "/campaigns", pro: false },
      { name: "Contacts", path: "/contacts", pro: false },
      { name: "Properties", path: "/properties", pro: false },
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
  {
    icon: <CalenderIcon />,
    name: "Calendar",
    path: "/calendar",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    icon: <ShootingStarIcon />,
    name: "Plans",
    path: "/plans",
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();

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

  const isActive = useCallback((path: string) => path === pathname, [pathname]);

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
              {renderMenuItems(navItems)}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
