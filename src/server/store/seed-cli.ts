import { writeDatabase } from "@/src/server/store/db"
import { buildSeedDatabase } from "@/src/server/store/seed"

writeDatabase(buildSeedDatabase())
console.log("Lumina seed data written.")
