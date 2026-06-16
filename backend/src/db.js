import pg from 'pg'
import dotenv from 'dotenv'
const {Pool} = pg

dotenv.config();

console.log("DB Config:", {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD ? "SET" : "NOT SET"
  })

const pool = new Pool({
    host : process.env.DB_HOST,
    port : process.env.DB_PORT,
    user : process.env.DB_USER,
    password : process.env.DB_PASSWORD,
    database : process.env.DB_NAME,
})

export default pool;