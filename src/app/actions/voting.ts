"use server";

import { supabase } from "@/src/lib/supabase";

export async function submitVoteAction(playerId: string, roomCode: string, votedForId: string) {
  try {
    // 1. Record the vote
    const { error: updateError } = await supabase
      .from("players")
      .update({ voted_for: votedForId })
      .eq("id", playerId);

    if (updateError) throw updateError;

    // 2. Check if everyone has voted
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("voted_for")
      .eq("room_code", roomCode);

    if (playersError || !players) throw new Error("Could not fetch player statuses.");

    // Check if EVERY player has cast a vote (voted_for is not null)
    const allVoted = players.every((p) => p.voted_for !== null);

    // 3. If all voted, move the global room state to resolution
    if (allVoted) {
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ game_status: "resolution" })
        .eq("room_code", roomCode);

      if (roomError) throw roomError;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Submit Vote Error:", error);
    return { success: false, error: error.message };
  }
}