"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase"; // Adjust if your lib folder is inside src/

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Helper to generate a 4-letter room code
  const generateRoomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = async () => {
    setErrorMsg("");
    if (!playerName.trim()) {
      setErrorMsg("Don't be senseless. Enter a name.");
      return;
    }

    setIsLoading(true);
    const newRoomCode = generateRoomCode();
    const playerId = crypto.randomUUID(); // Generate identity locally

    try {
      // 1. Create the Room
      const { error: roomError } = await supabase.from("rooms").insert({
        room_code: newRoomCode,
        host_id: playerId,
        game_status: "lobby",
        round_settings: { max_rounds: 5 },
      });

      if (roomError) throw roomError;

      // 2. Create the Player (Host)
      const { error: playerError } = await supabase.from("players").insert({
        id: playerId,
        room_code: newRoomCode,
        player_name: playerName.trim(),
        is_connected: true,
      });

      if (playerError) throw playerError;

      // 3. Save identity to localStorage so we survive page refreshes
      localStorage.setItem("senseless_player_id", playerId);

      // 4. Beam them into the lobby
      router.push(`/room/${newRoomCode}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to create room. Check your database connection.");
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    setErrorMsg("");
    if (!playerName.trim()) {
      setErrorMsg("Who are you? Enter a name first.");
      return;
    }
    if (joinCode.length !== 4) {
      setErrorMsg("Room codes are 4 letters, genius.");
      return;
    }

    setIsLoading(true);
    const upperCode = joinCode.toUpperCase();
    const playerId = crypto.randomUUID();

    try {
      // 1. Verify the room actually exists
      const { data: room, error: fetchError } = await supabase
        .from("rooms")
        .select("room_code, game_status")
        .eq("room_code", upperCode)
        .single();

      if (fetchError || !room) {
        throw new Error("Room not found. Did you hallucinate that code?");
      }

      if (room.game_status !== "lobby") {
        throw new Error("Game already started! You are too late.");
      }

      // 2. Insert the joining player
      const { error: playerError } = await supabase.from("players").insert({
        id: playerId,
        room_code: upperCode,
        player_name: playerName.trim(),
        is_connected: true,
      });

      if (playerError) throw playerError;

      // 3. Save identity and route to lobby
      localStorage.setItem("senseless_player_id", playerId);
      router.push(`/room/${upperCode}`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to join room.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow p-6 space-y-10">
      {/* Title Treatment */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-7xl text-fleshy-pink shadow-chunky-green uppercase tracking-wider transform -rotate-3">
          Senseless
        </h1>
        <p className="font-sans text-warning-yellow font-bold text-lg tracking-wide">
          Make sense of the nonsense.
        </p>
      </div>

      {/* Interaction Zone */}
      <div className="w-full flex flex-col gap-6 mt-8">
        {/* Error Display */}
        {errorMsg && (
          <div className="bg-warning-yellow text-bruise-purple font-bold p-3 rounded-xl text-center border-4 border-bruise-purple shadow-chunky-green animate-pulse">
            {errorMsg}
          </div>
        )}

        {/* Global Name Input */}
        <input
          type="text"
          placeholder="YOUR NAME"
          maxLength={15}
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          disabled={isLoading}
          className="w-full bg-white text-bruise-purple font-display text-4xl text-center placeholder:text-gray-400 py-3 rounded-xl border-4 border-fleshy-pink focus:outline-none focus:border-toxic-green uppercase transition-colors disabled:opacity-50"
        />

        <button
          onClick={handleCreateRoom}
          disabled={isLoading}
          className="w-full bg-toxic-green text-bruise-purple font-display text-4xl py-4 rounded-xl shadow-chunky transition-transform active:translate-y-1 active:shadow-none border-4 border-bruise-purple disabled:opacity-50"
        >
          {isLoading ? "MUTATING..." : "Create Room"}
        </button>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t-4 border-fleshy-pink opacity-50"></div>
          <span className="flex-shrink-0 mx-4 text-fleshy-pink font-bold font-sans uppercase text-sm tracking-widest">
            Or
          </span>
          <div className="flex-grow border-t-4 border-fleshy-pink opacity-50"></div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            placeholder="CODE"
            maxLength={4}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            disabled={isLoading}
            className="flex-1 bg-white text-bruise-purple font-display text-4xl text-center placeholder:text-gray-400 rounded-xl border-4 border-fleshy-pink focus:outline-none focus:border-warning-yellow uppercase disabled:opacity-50"
          />
          <button
            onClick={handleJoinRoom}
            disabled={isLoading}
            className="bg-fleshy-pink text-white font-display text-4xl px-8 rounded-xl shadow-chunky transition-transform active:translate-y-1 active:shadow-none border-4 border-bruise-purple disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}