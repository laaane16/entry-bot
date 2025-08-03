const fs = require('fs');
const path = require('path');
const {createClient, disconnectClient} = require('../dist/accounts');
const {pool} = require('../dist/db')
const input = require('input');

const accountsPath = path.resolve(__dirname, '..', 'accounts.json');
const ACCOUNTS = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));

const getNewSessionString = async (apiId, apiHash, phone, password, proxy) => {
  const client = createClient(apiId, apiHash, '', proxy)
  await client.start({
    phoneNumber: async () => phone,
    password: async () => password,
    phoneCode: async () => await input.text(`Введите проверочный код для аккаунта с apiId: ${apiId}, phone: ${phone}:`),
    onError: (err) => console.log(err)
  });

  const session = client.session.save();
  await disconnectClient(client);
  
  await new Promise((res) => {
    setTimeout(() => {
      res();
    }, 1000)
  })

  // @ts-ignore
  return session;
}

const createAccount = async ({apiId, apiHash, phone, password}) => {
  const {rows} = await pool.query(
    `SELECT * FROM accounts WHERE ${apiId} = "apiId"`
  )
  const account = rows[0];
  if (account){
    return;
  }

  const session = await getNewSessionString(apiId, apiHash, phone, password);

  await pool.query(`
    INSERT INTO accounts ("apiId", "apiHash", session)
    VALUES (${apiId}, '${apiHash}', '${session}')
    ON CONFLICT ("apiId") DO NOTHING;
  `)
}

(async function (){
  for (const account of ACCOUNTS){
    try{
      await createAccount(account);
    }
    catch(e){
      console.log(`Произошла ошибка при создании аккаунта ${account.apiId}; Ошибка: ${e}`)
    }
  }
  process.exit(0);
})()

