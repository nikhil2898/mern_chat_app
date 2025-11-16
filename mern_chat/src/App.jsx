import { UserContextProvider } from "./Context/UserContext.jsx";
import  Routes  from "./Routes.jsx";

export default function App() {
  return (
    <UserContextProvider>
      <Routes />
    </UserContextProvider>
  );
}
