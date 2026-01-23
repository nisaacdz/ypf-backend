import { Client } from "pg";

async function seedStarter() {
  if (!process.argv.includes("--confirm")) {
    console.error("❌ You must explicitly pass --confirm to do starter seed.");
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();

    await client.query(`
        INSERT INTO core.chapters (name, country) VALUES
('University of Ghana', 'Ghana'),
('University of Cape Coast', 'Ghana'),
('University of Education', 'Ghana'),
('Ashesi University', 'Ghana'),
('University of Energy and Natural Resources', 'Ghana'),
('University of Mines and Technology', 'Ghana'),
('KNUST Chapter', 'Ghana');

INSERT INTO core.committees (name, description) VALUES
('Management Board', 'Responsible for governance, approvals, and organizational structure.'),
('Financial Committee', 'Handles all finances, budgets, donations, and dues.'),
('Program Committee', 'Runs major YPF Africa programs.'),
('Media Committee', 'Handles media, publicity, and brand communications.'),
('Welfare Committee', 'Supports member well-being and personal development.'),
('Records Management Committee', 'Custodians of data and record-keeping.'),
('Digital & Cybersecurity Committee', 'Manages technical infrastructure and security.'),
('Legal Committee', 'Ensures legal compliance and manages policy.'),
('Sponsorship Committee', 'Manages partner and sponsor relationships.'),
('Institutional Committee', 'Oversees campus chapters and documentation.');

`);
  } catch (error) {
    console.error("Error seeding starter data:", error);
    throw error;
  } finally {
    await client.end();
  }
}

seedStarter();
