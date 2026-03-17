"use server";

import { supabase } from "@/src/lib/supabase";
import { Sense } from "@/src/types/database";

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function startGameAction(roomCode: string, hostId: string) {
  try {
    // 1. Verify the Room and get the current round
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("host_id, current_round")
      .eq("room_code", roomCode)
      .single();

    if (roomError || !room) throw new Error("Room not found.");
    if (room.host_id !== hostId) throw new Error("Only the host can start the game.");

    // 2. Fetch all Prompts and pick one at random
    const { data: prompts, error: promptError } = await supabase
      .from("prompts")
      .select("id");

    if (promptError || !prompts || prompts.length === 0) {
      throw new Error("No prompts available in the database.");
    }
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    // 3. Fetch all Players in the room
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id")
      .eq("room_code", roomCode);

    if (playersError || !players || players.length < 3) {
      throw new Error("Not enough players to start.");
    }

    // 4. Shuffle Players and Senses
    const shuffledPlayers = shuffleArray(players);
    const senses: Sense[] = ["Sight", "Sound", "Smell", "Touch", "Taste"];
    const shuffledSenses = shuffleArray(senses);

    // 5. Update every player individually (0th index becomes the Imposter)
    const playerUpdates = shuffledPlayers.map((player, index) => {
      return supabase
        .from("players")
        .update({
          is_imposter: index === 0, // The first player in the shuffled array is the imposter
          assigned_sense: shuffledSenses[index % senses.length], // Loop through senses if > 5 players
          current_clue: null, // Clear any old clues from previous rounds
        })
        .eq("id", player.id);
    });

    await Promise.all(playerUpdates);

    // 6. Finally, update the room to trigger the phase change for all connected clients
    const { error: updateRoomError } = await supabase
      .from("rooms")
      .update({
        game_status: "writing",
        current_prompt_id: randomPrompt.id,
        current_round: room.current_round + 1,
      })
      .eq("room_code", roomCode);

    if (updateRoomError) throw updateRoomError;

    return { success: true };
  } catch (error: any) {
    console.error("Game Start Error:", error);
    return { success: false, error: error.message };
  }
}