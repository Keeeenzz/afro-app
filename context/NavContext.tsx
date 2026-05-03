import React, { createContext, useContext, useState } from 'react';

interface NavContextType {
  isNavOpen: boolean;
  openNav: () => void;
  closeNav: () => void;
}

const NavContext = createContext<NavContextType>({
  isNavOpen: false,
  openNav: () => {},
  closeNav: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  return (
    <NavContext.Provider
      value={{
        isNavOpen,
        openNav: () => setIsNavOpen(true),
        closeNav: () => setIsNavOpen(false),
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export const useNav = () => useContext(NavContext);