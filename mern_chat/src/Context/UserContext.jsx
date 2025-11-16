/* eslint-disable react-refresh/only-export-components */
import api from "../api/axios.js";
import { useEffect, useState, createContext } from "react";

export const UserContext = createContext({});

export function UserContextProvider({ children }) {
  const [username, setLoggedInUsername] = useState(null);
  const [id, setid] = useState(null);

  useEffect(() => {
    let cancel = false;
    api
      .get("/profile")
      .then(({ data }) => {
        if (cancel) return;
        setLoggedInUsername(data.username);
        setid(data.id);
      })
      .catch(() => {
        if (cancel) return;
        setLoggedInUsername(null);
        setid(null);
      });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <UserContext.Provider value={{ username, setLoggedInUsername, id, setid }}>
      {children}
    </UserContext.Provider>
  );
}
