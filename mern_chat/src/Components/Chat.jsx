// src/Components/Chat.jsx
import React, { useEffect, useRef, useState, useContext } from "react";
import Avatar from "../Avatar";
import Logo from "./Logo";
import axios from "../api/axios.js";
import { UserContext } from "../Context/UserContext.jsx";

const Chat = () => {
  const wsRef = useRef(null);
  const sendQueueRef = useRef([]);
  const messagesEndRef = useRef(null);
  const heartbeatRef = useRef(null); // sends periodic heartbeats to server
  const fileInputRef = useRef(null);

  // states
  const [people, setPeople] = useState([]); // all users from server
  const [onlinePeople, setOnlinePeople] = useState({}); // map userId -> username
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState([]);

  const { username, id, setid, setLoggedInUsername } = useContext(UserContext);

  function logout() {
    axios.post("/logout").then(() => {
      setid(null);
      setLoggedInUsername(null);
    });
  }

  // Helper: normalize a message object to a common shape
  function normalizeMessage(m) {
    return {
      _id: m._id ?? m.id ?? m.localId ?? null,
      sender: m.sender ?? m.userId ?? m.from ?? null,
      recipient: m.recipient ?? m.to ?? m.target ?? null,
      text: m.text ?? m.message ?? m.content ?? m.body ?? "",
      createdAt: m.createdAt ?? m.timestamp ?? m.time ?? null,
      file: m.file ?? m.__raw?.file ?? null, // file metadata if present
      type: m.type ?? m.__raw?.type ?? null,
      __raw: m,
    };
  }

  // Get display name (works for both online & offline users)
  function getDisplayName(userId) {
    if (!userId) return "Unknown";
    const idStr = String(userId);

    if (onlinePeople[idStr]) {
      return onlinePeople[idStr];
    }

    const person = people.find((p) => String(p._id) === idStr);
    if (person) {
      return person.username ?? person.name ?? idStr;
    }

    return idStr;
  }

  // Heartbeat: let server know we're alive (every 5s)
  function startHeartbeat() {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => {
      const ws = wsRef.current;
      try {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
        }
      } catch (e) {
        console.warn("Heartbeat send failed", e);
      }
    }, 5000);
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  // WebSocket setup
  useEffect(() => {
    const sock = new WebSocket("ws://localhost:5000");
    wsRef.current = sock;

    sock.addEventListener("open", () => {
      console.log("WS open");
      startHeartbeat();
      while (
        sendQueueRef.current.length > 0 &&
        sock.readyState === WebSocket.OPEN
      ) {
        sock.send(sendQueueRef.current.shift());
      }
    });

    sock.addEventListener("error", (e) => {
      console.error("WS error:", e);
    });

    sock.addEventListener("close", (e) => {
      console.warn("WS closed:", e.code, e.reason);
      stopHeartbeat();
    });

    sock.addEventListener("message", handleMessage);

    return () => {
      sock.removeEventListener("message", handleMessage);
      try {
        sock.close();
      } catch {
        /* empty */
      }
      stopHeartbeat();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify server when tab closes/refreshes (best-effort)
  useEffect(() => {
    const onUnload = () => {
      try {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "deactivate" }));
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  }, [messages, selectedUserId]);

  // Fetch all people once (on mount)
  useEffect(() => {
    let cancelled = false;
    axios
      .get("/people")
      .then((res) => {
        if (!cancelled) {
          setPeople(Array.isArray(res.data) ? res.data : []);
        }
      })
      .catch((err) => {
        console.error("Error fetching people:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch messages when selected user changes
  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    axios
      .get(`/messages/${selectedUserId}`)
      .then((res) => {
        const normalized = Array.isArray(res.data)
          ? res.data.map(normalizeMessage)
          : [];
        if (!cancelled) setMessages(normalized);
        console.log("loaded messages:", normalized);
      })
      .catch((err) => {
        console.error("Error loading messages:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId]);

  // Update online people mapping from WS payload
  function showOnlinePeople(peopleArray) {
    const peopleMap = {};
    peopleArray.forEach((u) => {
      if (u?.userId)
        peopleMap[String(u.userId)] = u.username ?? u.name ?? u.userId;
    });
    setOnlinePeople(peopleMap);
  }

  // WS message handler
  function handleMessage(e) {
    try {
      const messageData = JSON.parse(e.data);

      // presence list
      if ("online" in messageData) {
        showOnlinePeople(messageData.online);
        return;
      }

      // batch of messages
      if (Array.isArray(messageData)) {
        const normalized = messageData.map(normalizeMessage);
        setMessages((prev) => {
          const ids = new Set(
            prev
              .filter(Boolean)
              .map((p) => p._id)
              .filter(Boolean)
          );
          const deduped = normalized.filter((m) => !(m._id && ids.has(m._id)));
          return [...prev, ...deduped];
        });
        return;
      }

      // file message
      if (messageData.type === "file") {
        const nm = normalizeMessage(messageData);
        setMessages((prev) => {
          if (nm._id && prev.some((p) => p._id === nm._id)) return prev;
          return [...prev, nm];
        });
        return;
      }

      // single text message
      const nm = normalizeMessage(messageData);
      if (nm.text || messageData.type === "message") {
        setMessages((prev) => {
          if (nm._id && prev.some((p) => p._id === nm._id)) return prev;
          return [...prev, nm];
        });
      } else {
        console.log("WS event:", messageData);
      }
    } catch (err) {
      console.error("Bad JSON from server:", err, e?.data);
    }
  }

  // Derive offline people
  // Derive offline people
  const offlinePeople = React.useMemo(() => {
    const myId = String(id ?? "");
    const myName = String(username ?? "").toLowerCase();

    const onlineIds = new Set(Object.keys(onlinePeople).map(String));

    return people.filter((p) => {
      const pid = String(p._id ?? "");
      const pname = String(p.username ?? p.name ?? "").toLowerCase();

      // exclude yourself by id AND by username (extra safety)
      if (pid === myId) return false;
      if (pname && pname === myName) return false;

      // exclude anyone currently online
      if (onlineIds.has(pid)) return false;

      return true;
    });
  }, [people, onlinePeople, id, username]);

  // Online people excluding current user
  const onlineExclUser = React.useMemo(() => {
    const copy = { ...onlinePeople };
    delete copy[String(id)];
    return copy;
  }, [onlinePeople, id]);

  // Send text message – rely ONLY on server echo (no local copy)
  function sendMessage(ev) {
    ev.preventDefault();
    if (!selectedUserId) return;
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    const payloadObj = {
      recipient: selectedUserId,
      text: trimmed,
    };
    const payload = JSON.stringify(payloadObj);

    const ws = wsRef.current;
    if (!ws) {
      console.warn("WebSocket not initialized — queuing message");
      sendQueueRef.current.push(payload);
    } else if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else if (ws.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket connecting — queuing message");
      sendQueueRef.current.push(payload);
    } else {
      console.warn(
        "WebSocket is closing/closed — queuing message",
        ws.readyState
      );
      sendQueueRef.current.push(payload);
    }

    setNewMessage("");
  }

  // HANDLE FILE SELECT: read file as base64 and send via WS
  function handleFileSelect(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (!selectedUserId) {
      alert("Select a user to send the file to.");
      return;
    }

    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      if (
        !window.confirm(
          "File is large and may fail to send via WebSocket. Proceed?"
        )
      ) {
        ev.target.value = "";
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = String(dataUrl).includes(",")
        ? String(dataUrl).split(",")[1]
        : dataUrl;

      const payload = {
        type: "file",
        recipient: selectedUserId,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        data: base64,
      };

      const payloadStr = JSON.stringify(payload);
      const ws = wsRef.current;
      if (!ws) {
        sendQueueRef.current.push(payloadStr);
      } else if (ws.readyState === WebSocket.OPEN) {
        ws.send(payloadStr);
      } else {
        sendQueueRef.current.push(payloadStr);
      }

      // no local optimistic copy; rely on server "file" broadcast
      ev.target.value = "";
    };

    reader.onerror = (err) => {
      console.error("File read error", err);
      ev.target.value = "";
    };

    reader.readAsDataURL(file);
  }

  // Render message content
  function renderMessageContent(m) {
    if (m.type === "file" || m.file) {
      const fileMeta = m.file ?? (m.__raw && m.__raw.file) ?? null;

      const baseURL = (axios.defaults && axios.defaults.baseURL) || "";
      const url = fileMeta?.url
        ? fileMeta.url.startsWith("http")
          ? fileMeta.url
          : baseURL + fileMeta.url
        : null;

      if (url) {
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="underline break-all"
          >
            {fileMeta.filename}
          </a>
        );
      }

      return <span className="italic">{fileMeta?.filename ?? m.text}</span>;
    }

    return <span className="break-words whitespace-pre-wrap">{m.text}</span>;
  }

  return (
    <div className="flex h-screen">
      <aside className="w-1/3  border-r overflow-auto flex flex-col bg-blue-50">
        <div className="flex-grow">
          <div className="p-4">
            <Logo />
          </div>

          {/* Online users */}
          <div className="divide-y">
            <div className="px-4 py-2 text-xs text-gray-500 font-bold">
              Online
            </div>
            {Object.keys(onlineExclUser ?? {}).length === 0 ? (
              <div className="p-4 text-gray-600 font-bold">
                No one is online
              </div>
            ) : (
              Object.keys(onlineExclUser).map((userId) => (
                <button
                  key={userId}
                  onClick={() => setSelectedUserId(userId)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white focus:outline-none cursor-pointer ${
                    userId === selectedUserId ? "bg-blue-50" : ""
                  }`}
                >
                  {userId === selectedUserId && (
                    <div className="w-1 bg-blue-500 h-10 rounded-r" />
                  )}
                  <Avatar
                    online={true}
                    username={onlineExclUser[userId]}
                    userId={userId}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {onlineExclUser[userId]}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Offline users */}
          <div className="divide-y mt-2">
            <div className="px-4 py-2 text-xs text-gray-500 font-bold">
              Offline
            </div>
            {offlinePeople.length === 0 ? (
              <div className="p-4 text-gray-500 font-bold">
                No offline people
              </div>
            ) : (
              offlinePeople.map((p) => (
                <button
                  key={String(p._id)}
                  onClick={() => setSelectedUserId(String(p._id))}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-white focus:outline-none cursor-pointer ${
                    String(p._id) === String(selectedUserId) ? "bg-blue-50" : ""
                  }`}
                >
                  {String(p._id) === String(selectedUserId) && (
                    <div className="w-1 bg-blue-500 h-10 rounded-r" />
                  )}
                  <Avatar
                    online={false}
                    username={p.username ?? p.name ?? "Unknown"}
                    userId={String(p._id)}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {p.username ?? p.name ?? p._id}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-2 text-center flex items-center justify-around cursor-pointer">
          <span className="mr-2 text-sm text-gray-600 font-bold flex items-center gap-1 hover:font-bold hover-text-black">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-6"
            >
              <path
                fillRule="evenodd"
                d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
                clipRule="evenodd"
              />
            </svg>
            {username}
          </span>
          <button
            onClick={logout}
            className="text-sm text-white bg-blue-600 py-1 px-2 border rounded-sm cursor-pointer hover:bg-blue-600 hover:text-white focus:outline-none hover:font-bold"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col bg-gradient-to-r from-blue-50 to-blue-100">
        {/* Header */}
        <header className="px-4 py-3 border-b bg-white flex items-center justify-between">
          <div>
            {selectedUserId ? (
              <div className="text-sm font-semibold text-gray-800">
                Chat with{" "}
                <span className="text-blue-600">
                  {getDisplayName(selectedUserId)}
                </span>
              </div>
            ) : (
              <div className="text-sm text-gray-900">
                Select a person to start chat
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <section
          className="flex-1 overflow-auto p-4"
          id="messagesArea"
          role="log"
          aria-live="polite"
        >
          {selectedUserId ? (
            messages && messages.length > 0 ? (
              <>
                {messages.map((message, idx) => {
                  const m = normalizeMessage(message);

                  if (
                    !(
                      String(m.sender) === String(selectedUserId) ||
                      String(m.recipient) === String(selectedUserId)
                    )
                  ) {
                    return null;
                  }

                  if (!m.text && !m.file) return null;

                  const isMe = String(m.sender) === String(id);
                  return (
                    <div
                      key={m._id ?? `msg-${idx}`}
                      className={`mb-3 flex ${
                        isMe ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] px-3 py-2 rounded-md text-sm break-words ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-white text-gray-800 rounded-bl-none shadow-sm"
                        }`}
                      >
                        <div className="text-xs text-gray-300 mb-1">
                          {isMe ? "You" : getDisplayName(m.sender)}
                        </div>
                        <div>{renderMessageContent(m)}</div>
                      </div>
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </>
            ) : (
              <div className="text-center text-gray-400 mt-8">
                No messages yet. Say hi 👋
              </div>
            )
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              &larr; Select a person from the sidebar
            </div>
          )}
        </section>

        {/* Composer */}
        {selectedUserId && (
          <footer className="px-4 py-3 bg-white border-t">
            <form className="flex gap-3" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={(ev) => setNewMessage(ev.target.value)}
                placeholder={`Message ${getDisplayName(selectedUserId)}...`}
                className="flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <label className="inline-flex items-center px-4 py-2 text-gray-600 rounded-md border bg-blue-200 border-blue-300 cursor-pointer hover:bg-blue-800 hover:text-white ">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z"
                    clipRule="evenodd"
                  />
                </svg>
              </label>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </form>
          </footer>
        )}
      </main>
    </div>
  );
};

export default Chat;
