const Avatar = ({ userId: propUserId, userid, username , online}) => {
const colors = [
  "bg-gradient-to-r from-pink-400 to-red-400",
  "bg-gradient-to-r from-rose-400 to-orange-400",
  "bg-gradient-to-r from-purple-400 to-indigo-400",
  "bg-gradient-to-r from-violet-400 to-purple-500",
  "bg-gradient-to-r from-blue-400 to-cyan-400",
  "bg-gradient-to-r from-sky-400 to-blue-500",
  "bg-gradient-to-r from-emerald-400 to-green-500",
  "bg-gradient-to-r from-teal-400 to-cyan-500",
  "bg-gradient-to-r from-lime-400 to-green-400",
  "bg-gradient-to-r from-yellow-400 to-amber-500",
  "bg-gradient-to-r from-orange-400 to-red-500",
  "bg-gradient-to-r from-fuchsia-400 to-pink-500",
  "bg-gradient-to-r from-indigo-400 to-blue-500",
  "bg-gradient-to-r from-cyan-400 to-teal-500",
  "bg-gradient-to-r from-rose-300 to-pink-400",
];

  const userId =
    typeof propUserId === "string"
      ? propUserId
      : typeof userid === "string"
      ? userid
      : "";
  let userIdBase10 = 0;
  if (userId) {
    const parsed = parseInt(userId, 16);
    if (!Number.isNaN(parsed)) userIdBase10 = parsed;
  }

  const colorIndex = userIdBase10 % colors.length;
  const color = colors[colorIndex] || colors[0];

  return (
    <div
      className={`w-8 h-8 relative rounded-full flex items-center justify-center ${color}`}
    >
      <div className="text-center font-bold text-gray-800">
        {username?.[0]?.toUpperCase() || "?"}
      </div>
      {online && (
        <div className="absolute w-3 h-3 bg-green-500 rounded-full -right-1 -bottom-1 border border-white shadow-md"></div>
      )}
      {/* {offline && (
        <div className="absolute w-3 h-3 bg-green-500 rounded-full -right-1 -bottom-1 border border-white shadow-md"></div>
      )} */}
    </div>
  );
};

export default Avatar;
