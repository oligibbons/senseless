"use server";

import { supabase } from "@/src/lib/supabase";

export async function submitClueAction(playerId: string, roomCode: string, clue: string) {
  try {
    // 1. Save the player's clue
    const { error: updateError } = await supabase
      .from("players")
      .update({ current_clue: clue.trim() })
      .eq("id", playerId);

    if (updateError) throw updateError;

    // 2. Check if everyone in the room has submitted
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("current_clue")
      .eq("room_code", roomCode);

    if (playersError || !players) throw new Error("Could not fetch player statuses.");

    // Check if EVERY player has a clue that is not null and not empty
    const allSubmitted = players.every(
      (p) => p.current_clue !== null && p.current_clue.trim() !== ""
    );

    // 3. If all submitted, move the global room state to voting
    if (allSubmitted) {
      const { error: roomError } = await supabase
        .from("rooms")
        .update({ game_status: "voting" })
        .eq("room_code", roomCode);

      if (roomError) throw roomError;
    }

    return { success: true };
  } catch (error: any) {
    console.error("Submit Clue Error:", error);
    return { success: false, error: error.message };
  }
}