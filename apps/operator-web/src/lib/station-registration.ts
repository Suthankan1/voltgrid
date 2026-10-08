export type RegistrationState = {message?: string; id?: string; name?: string};
export function localRegistrationEnabled(): boolean {
  if (process.env.OPERATOR_LOCAL_WRITES !== "true") return false;
  try {
    const endpoint = new URL(process.env.STATION_GRAPHQL_URL ?? "");
    return endpoint.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname);
  } catch { return false; }
}
export async function registerStation(idValue: unknown, nameValue: unknown): Promise<RegistrationState & {stationId?:string}> {
  if (!localRegistrationEnabled()) return {message:"Registration is disabled. This console is in read-only mode."};
  const id = typeof idValue === "string" ? idValue.trim() : "";
  const name = typeof nameValue === "string" ? nameValue.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(id)) return {id,name,message:"Use 1–255 letters, numbers, dots, underscores, colons or hyphens for the station identifier."};
  if (!name || name.length > 255) return {id,name,message:"Enter a station name between 1 and 255 characters."};
  try {
    const response = await fetch(process.env.STATION_GRAPHQL_URL!, {
      method:"POST", headers:{"Content-Type":"application/json"}, cache:"no-store",signal:AbortSignal.timeout(5000),
      body:JSON.stringify({query:`mutation OperatorRegister($input: RegisterStationInput!) { registerStation(input:$input) { id name status } }`,variables:{input:{id,name}}}),
    });
    if (!response.ok) throw new Error("Registration HTTP failure");
    const payload = await response.json();
    if (payload.errors?.length) return {id,name,message:payload.errors.some((error:{message?:string})=>error.message===`Station already exists: ${id}`)
      ? "This station identifier is already registered. Choose another identifier." : "Registration failed. Check the details and try again."};
    if (payload.data?.registerStation?.id !== id) throw new Error("Invalid registration response");
    return {stationId:id};
  } catch { return {id,name,message:"Registration could not be confirmed. Check the fleet before retrying to avoid duplicates."}; }
}
