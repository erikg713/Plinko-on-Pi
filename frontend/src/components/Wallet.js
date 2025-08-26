import React from "react";

export default function Wallet({ user }) {
  if (!user) return <p>🔑 Please login with Pi Browser...</p>;

  return (
    <div>
      <h3>Welcome, {user.username}!</h3>
      <p>User ID: {user.uid}</p>
    </div>
  );
}
