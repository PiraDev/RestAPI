const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser'); 

const app = express();

const connection = mysql.createConnection({
  host: '18.217.235.139',
  user: 'your_user',
  password: 'your_password',
  database: 'separae'
});

connection.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('Conexão bem-sucedida ao banco de dados MySQL');
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('HELLO');
});

app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  connection.query('SELECT * FROM Users WHERE email = ? AND pass = ?', [email, senha], (err, userResults) => {
    if (err) {
      console.error('Erro ao executar a consulta de usuário:', err);
      res.status(500).send('Erro ao validar as credenciais de login');
      return;
    }
    if (userResults.length === 0) {
      res.status(401).send('Credenciais de login inválidas');
    } else {
      const user = userResults[0]; 
      connection.query(`
        SELECT ps.nome AS session_name, th.total_spent, th.creation_date
        FROM TransactionHistory th
        INNER JOIN PaymentSession ps ON th.session_id = ps.session_id
        WHERE th.user_id = ?
      `, [user.user_id], (err, transactionResults) => {
        if (err) {
          console.error('Erro ao obter o histórico de transações:', err);
          res.status(500).send('Erro ao obter o histórico de transações');
          return;
        }
        res.status(200).json({
          message: 'Credenciais de login válidas',
          user: {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            balance: user.balance,
            transaction_history: transactionResults 
          }
        });
      });
    }
  });
});

app.post('/register', (req, res) => {
  const { username, email, senha } = req.body;

  connection.query('SELECT * FROM Users WHERE email = ?', [email], (err, emailCheckResults) => {
    if (err) {
      console.error('Erro ao verificar o email:', err);
      res.status(500).send('Erro ao verificar o email');
    } else {
      connection.query('INSERT INTO Users (username, email, pass) VALUES (?, ?, ?)', [username, email, senha], (err, insertResult) => {
        if (err) {
          console.error('Erro ao inserir novo usuário:', err);
          res.status(500).send('Erro ao registrar novo usuário');
        } else {
          const userId = insertResult.insertId;
          res.status(201).json({
            message: 'Usuário registrado com sucesso',
            user: {
              user_id: userId,
              username: username,
              email: email,
              balance: 0,
              transaction_history: [] 
            }
          });
        }
      });
    }
  });
});

app.get('/transactions/:userId', (req, res) => {
  const userId = req.params.userId; 

  connection.query(`
    SELECT ps.nome AS session_name, th.total_spent, th.creation_date
    FROM TransactionHistory th
    INNER JOIN PaymentSession ps ON th.session_id = ps.session_id
    WHERE th.user_id = ?
  `, [userId], (err, transactionResults) => {
    if (err) {
      console.error('Erro ao obter o histórico de transações:', err);
      res.status(500).send('Erro ao obter o histórico de transações');
    } else {
      res.status(200).json({ transactions: transactionResults });
    }
  });
});

app.get('/balance/:userId', (req, res) => {
  const userId = req.params.userId; 

  connection.query('SELECT balance FROM Users WHERE user_id = ?', [userId], (err, balanceResult) => {
    if (err) {
      console.error('Erro ao obter o saldo do usuário:', err);
      res.status(500).send('Erro ao obter o saldo do usuário');
    } else {
      if (balanceResult.length === 0) {
        res.status(404).send('Usuário não encontrado');
      } else {
        const balance = balanceResult[0].balance;
        res.status(200).json({ balance });
      }
    }
  });
});

app.get('/friendships/:userId', (req, res) => {
  const userId = req.params.userId; 

  connection.query(`
    SELECT DISTINCT u.username
    FROM Users u
    INNER JOIN (
      SELECT user_id AS id FROM Friendships WHERE friend_id = ? AND is_accepted = TRUE
    ) AS friend_ids ON u.user_id = friend_ids.id
  `, [userId, userId], (err, friendResults) => {
    if (err) {
      console.error('Erro ao obter os amigos do usuário:', err);
      res.status(500).send('Erro ao obter os amigos do usuário');
    } else {
      const friends = friendResults.map(friend => friend.username); 
      res.status(200).json({ friends });
    }
  });
});

app.listen(4000, () => {
  console.log('API está sendo executada na porta 4000');
});
