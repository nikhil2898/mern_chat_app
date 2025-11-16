import { useState, useContext } from "react";
import api from "../api/axios.js";
import { UserContext } from "../Context/UserContext.jsx";

export default function RegisterAndLoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPass] = useState("");
  const [mode, setMode] = useState("login"); // or "register"
  const [error, setError] = useState("");
  const { setLoggedInUsername, setid } = useContext(UserContext);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const url = mode === "register" ? "/register" : "/login";
    try {
      await api.post(url, { username, password }); // sets cookie
      const { data } = await api.get("/profile"); // read cookie -> get profile
      setLoggedInUsername(data.username);
      setid(data.id);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
    }
  }

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 h-screen flex items-center">
      <form className="w-64 mx-auto mb-12" onSubmit={handleSubmit}>
        <input
          className="block w-full rounded-sm p-2 mb-2 border"
          placeholder="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="block w-full rounded-sm p-2 mb-2 border"
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPass(e.target.value)}
        />
        <button className="bg-blue-500 text-white block w-full rounded-sm p-2 mb-2 hover:bg-blue-600 border:border-blue-300">
          {mode === "register" ? "Register" : "Login"}
        </button>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="text-center mt-2">
          {mode === "register" ? (
            <div>
              Already a member?{" "}
              <button type="button" onClick={() => setMode("login")}>
                Login here
              </button>
            </div>
          ) : (
            <div>
              Don’t have an account?{" "}
              <button type="button" onClick={() => setMode("register")}>
                Register here
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
