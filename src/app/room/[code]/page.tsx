"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/src/lib/supabase";
import { Player, Room } from "@/src/types/database";
import { startGameAction } from "@/src/app/actions/game";

export default function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const localId = localStorage.getItem("senseless_player_id");
    if (!localId) {
      router.replace("/");
      return;
    }
    setCurrentPlayerId(localId);

    const fetchInitialState = async () => {
      const { data: roomData, error: roomError } = await supabase
        .from("rooms")
        .select("*")
        .eq("room_code", code)
        .single();

      if (roomError || !roomData) {
        setErrorMsg("Room collapsed. Return to menu.");
        return;
      }
      setRoom(roomData as Room);

      const { data: playersData } = await supabase
        .from("players")
        .select("*")
        .eq("room_code", code)
        .order("last_seen", { ascending: true });

      if (playersData) setPlayers(playersData as Player[]);
    };

    fetchInitialState();

    const channel = supabase
      .channel(`room_${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_code=eq.${code}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setPlayers((prev) => [...prev, payload.new as Player]);
          } else if (payload.eventType === "UPDATE") {
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as Player) : p))
            );
          } else if (payload.eventType === "DELETE") {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `room_code=eq.${code}` },
        (payload) => {
          const updatedRoom = payload.new as Room;
          setRoom(updatedRoom);
          if (updatedRoom.game_status === "writing") {
            // The Server Action mutated the room successfully!
            console.log("GAME IS STARTING! All clients move to writing phase.");
            // We will replace this with a router.push to the writing screen next
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
        <h1 className="font-display text-5xl text-warning-yellow drop-shadow-chunky">ERROR</h1>
        <p className="font-sans text-white text-xl">{errorMsg}</p>
        <button onClick={() => router.replace("/")} className="bg-fleshy-pink text-white font-display text-3xl px-8 py-3 rounded-xl shadow-chunky">Go Home</button>
      </div>
    );
  }

  if (!room || !currentPlayerId) {
    return <div className="flex items-center justify-center h-full font-display text-4xl text-toxic-green animate-pulse">LOADING...</div>;
  }

  const isHost = room.host_id === currentPlayerId;
  const canStart = players.length >= 3;

  const handleStartGame = async () => {
    if (!isHost || !canStart || isStarting) return;
    
    setIsStarting(true);
    const result = await startGameAction(code, currentPlayerId);
    
    if (!result.success) {
      setErrorMsg(result.error || "Failed to start the game.");
      setIsStarting(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="text-center mb-8 mt-4">
        <p className="font-sans text-warning-yellow font-bold uppercase tracking-widest text-sm">Room Code</p>
        <h1 className="font-display text-7xl text-white tracking-widest drop-shadow-chunky">
          {code}
        </h1>
      </div>

      {/* Player List */}
      <div className="flex-grow flex flex-col gap-4 overflow-y-auto pb-4">
        <h2 className="font-display text-3xl text-fleshy-pink border-b-4 border-fleshy-pink pb-2">
          Meat-Sacks ({players.length}/8)
        </h2>
        
        {players.map((player) => (
          <div 
            key={player.id} 
            className={`p-4 rounded-xl border-4 shadow-chunky transition-all ${
              player.id === currentPlayerId 
                ? "bg-toxic-green border-bruise-purple text-bruise-purple shadow-chunky" 
                : "bg-white border-bruise-purple text-bruise-purple"
            }`}
          >
            <div className="flex justify-between items-center font-sans font-bold text-xl">
              <span>{player.player_name} {player.id === room.host_id && "👑"}</span>
              {player.id === currentPlayerId && <span className="text-sm opacity-60 uppercase">(You)</span>}
            </div>
          </div>
        ))}

        {players.length < 3 && (
          <div className="p-4 rounded-xl border-4 border-dashed border-white/20 text-white/50 text-center font-display text-2xl">
            Waiting for more victims...
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-auto pt-6">
        {isHost ? (
          <button 
            onClick={handleStartGame}
            disabled={!canStart || isStarting}
            className={`w-full font-display text-4xl py-4 rounded-xl border-4 border-bruise-purple transition-all ${
              canStart && !isStarting
                ? "bg-warning-yellow text-bruise-purple shadow-chunky-green active:translate-y-1 active:shadow-none" 
                : "bg-gray-500 text-gray-300 opacity-50 cursor-not-allowed"
            }`}
          >
            {isStarting ? "DEALING..." : canStart ? "Start Game" : "Need 3 Players"}
          </button>
        ) : (
          <div className="w-full text-center bg-dark-void border-4 border-fleshy-pink text-fleshy-pink font-display text-3xl py-4 rounded-xl animate-pulse">
            Waiting for Host...
          </div>
        )}
      </div>
    </div>
  );
}