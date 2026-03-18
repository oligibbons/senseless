"use server";

import { supabase } from "@/src/lib/supabase";

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function hostGameAction(playerName: string) {
  try {
    const code = generateRoomCode();
    const hostId = crypto.randomUUID();

    // 1. Create the Room
    const { error: roomError } = await supabase.from("rooms").insert({
      room_code: code,
      host_id: hostId,
      game_status: "lobby",
      current_round: 0,
      round_settings: { mode: "rounds", target: 5 },
      current_prompt_id: null
    });
    if (roomError) throw new Error(roomError.message);

    // 2. Create the Host Player
    const { error: playerError } = await supabase.from("players").insert({
      id: hostId,
      room_code: code,
      player_name: playerName,
      is_imposter: false,
      score: 0,
      is_connected: true
    });
    if (playerError) throw new Error(playerError.message);

    return { success: true, roomCode: code, playerId: hostId };
  } catch (error: any) {
    console.error("Host Game Error:", error);
    return { success: false, error: error.message };
  }
}

export async function joinGameAction(playerName: string, roomCode: string) {
  try {
    const code = roomCode.toUpperCase();
    
    // Check if the room exists and is open
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("room_code", code).single();
    
    if (roomError || !room) {
      return { success: false, error: "Room not found. Check the code." };
    }
    
    if (room.game_status !== "lobby") {
      return { success: false, error: "Game already in progress!" };
    }

    const playerId = crypto.randomUUID();

    // Add the player to the room
    const { error: playerError } = await supabase.from("players").insert({
      id: playerId,
      room_code: code,
      player_name: playerName,
      is_imposter: false,
      score: 0,
      is_connected: true
    });
    if (playerError) throw new Error(playerError.message);

    return { success: true, roomCode: code, playerId };
  } catch (error: any) {
    console.error("Join Game Error:", error);
    return { success: false, error: error.message };
  }
}