
import dbClient from "./configs/db";
import { sql } from "drizzle-orm";
import * as fs from 'fs';
import variables from "./configs/env";

async function checkConstituent() {
    const log = (msg: string) => fs.appendFileSync('output.txt', msg + '\n');

    try {
        log(`DB URL: ${variables.database.url.split('@')[1]}`); // Log host part only

        await dbClient.initialize();

        const id = "e54a5f20-a1e0-451d-bf29-0d652868f084";

        const users = await dbClient.db.execute(sql`SELECT * FROM core.constituents WHERE id = ${id}`);
        log(`Found users (raw core.constituents): ${users.length}`);

    } catch (err) {
        log(`Error: ${err}`);
    }

    process.exit(0);
}

checkConstituent().catch(err => fs.appendFileSync('output.txt', `Crash: ${err}\n`));
