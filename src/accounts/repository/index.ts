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
    INSERT INTO accounts ("apiId", "apiHash", session, phone)
    VALUES (${apiId}, '${apiHash}', '${session}', '${phone}')
    ON CONFLICT ("apiId") DO NOTHING;
  `)
}

export const deleteAccount = async (phone: string) => {
  const res = await pool.query(
    `DELETE FROM accounts WHERE "phone" = '${phone}'`
  )

  if (res.rowCount === 1){
    return 'Аккаунт успешно удалён';
  }

  return 'Аккаунта с таким номером не существует';
}

