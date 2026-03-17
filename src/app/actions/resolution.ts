"use server";

import { supabase } from "@/src/lib/supabase";

export async function finalizeRoundAction(
  roomCode: string,
  imposterId: string,
  imposterCaught: boolean,
  imposterStole: boolean
) {
  try {
    // 1. Fetch all players to analyze the votes
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("*")
      .eq("room_code", roomCode);

    if (playersError || !players) throw new Error("Could not fetch players.");

    // 2. Tally the votes
    const voteCounts: Record<string, number> = {};
    players.forEach((p) => {
      if (p.voted_for) {
        voteCounts[p.voted_for] = (voteCounts[p.voted_for] || 0) + 1;
      }
    });

    // 3. Calculate and apply scores
    const updates = players.map((p) => {
      let roundScore = 0;

      if (p.id === imposterId) {
        // The Imposter
        if (!imposterCaught) roundScore += 2; // The Getaway
        if (imposterCaught && imposterStole) roundScore += 2; // The Steal
      } else {
        // The Innocents
        if (p.voted_for === imposterId && !imposterStole) {
          roundScore += 1; // The Hunt (Negated if Imposter stole)
        }
        if (voteCounts[p.id] > 0) {
          roundScore -= 1; // The Penalty (Received rogue votes)
        }
      }

      // Update the player row (adding score, clearing round data)
      return supabase
        .from("players")
        .update({
          score: p.score + roundScore,
          current_clue: null,
          voted_for: null,
          assigned_sense: null,
          is_imposter: false,
        })
        .eq("id", p.id);
    });

    await Promise.all(updates);

    // 4. Reset the Room back to the Lobby
    const { error: roomError } = await supabase
      .from("rooms")
      .update({
        game_status: "lobby",
        current_prompt_id: null,
      })
      .eq("room_code", roomCode);

    if (roomError) throw roomError;

    return { success: true };
  } catch (error: any) {
    console.error("Finalize Round Error:", error);
    return { success: false, error: error.message };
  }
}