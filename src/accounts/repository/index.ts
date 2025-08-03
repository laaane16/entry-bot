import { pool } from "../../db";
import {getSessionString} from '..'
import { CodePrompter } from "../../bot";

export const createAccount = async (apiId: number, apiHash: string, phone: string, password: string, prompter: CodePrompter) => {
  const { rows } = await pool.query(`SELECT * FROM accounts WHERE "apiId" = ${apiId}`);
  if (rows[0]){
    console.log('Аккаунт уже существует');
    return;
  }

  const session = await getSessionString(apiId, apiHash, phone, password, prompter);

  pool.query(`
    INSERT INTO accounts ("apiId", "apiHash", session)
    VALUES (${apiId}, '${apiHash}', '${session}')
    ON CONFLICT ("apiId") DO NOTHING;
  `)
}

export const deleteAccount = async (apiId: number) => {
  pool.query(
    `DELETE FROM accounts WHERE "apiId" = ${apiId}`
  )
}

