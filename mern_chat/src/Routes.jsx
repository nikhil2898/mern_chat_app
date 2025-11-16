import { useContext } from "react";
import RegisterAndLoginForm from "./Components/RegisterAndLoginForm.jsx";
import { UserContext } from "./Context/UserContext.jsx";
import Chat from "./Components/Chat.jsx";

export default function Routes() {
  const { username } = useContext(UserContext);
  if (username) return <Chat />
  return <RegisterAndLoginForm />;
}
