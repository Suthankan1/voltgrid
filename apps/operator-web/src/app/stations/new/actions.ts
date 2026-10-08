"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { registerStation, type RegistrationState } from "@/lib/station-registration";
export async function registerStationAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const host = (await headers()).get("host") ?? "";
  try {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname)) return {message:"Registration is available only from the local console."};
  } catch { return {message:"Registration is available only from the local console."}; }
  const result = await registerStation(formData.get("id"), formData.get("name"));
  if (!result.stationId) return result;
  revalidatePath("/");
  redirect(`/stations/${encodeURIComponent(result.stationId)}`);
}
