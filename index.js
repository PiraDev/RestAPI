const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');


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
// Configuração do multer para salvar o arquivo no diretório desejado
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.userId;
    const ext = path.extname(file.originalname);
    cb(null, `${userId}${ext}`);
  }
});

const upload = multer({ storage: storage });

// Endpoint para upload de imagem
app.post('/upload-image', upload.single('image'), (req, res) => {
  const userId = req.body.userId;

  if (!req.file) {
    return res.status(400).send('Nenhum arquivo foi enviado.');
  }

  res.status(200).json({
    message: 'Upload de imagem bem-sucedido',
    filename: req.file.filename
  });
});



// Configurar o middleware para servir arquivos estáticos do diretório 'uploads'
app.use('/userimage', express.static(path.join(__dirname, 'uploads')));

// Outros middlewares e configurações do seu aplicativo
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Seu endpoint para obter a imagem do usuário
app.get('/userimage/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.params.filename);

  // Verificar se o arquivo existe
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Arquivo não encontrado');
  }
});



// Endpoint para validar e realizar o login de um usuário
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  connection.query('SELECT * FROM Users WHERE email = ? AND pass = ?', [email, senha], (err, userResults) => {
    if (err) {
      console.error('zErro ao executar a consulta de usuário:', err);
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



// Endpoint para registrar um novo usuário
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



// Endpoint para consultar o histórico de transações de um usuário
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



// Endpoint para consultar o saldo de um usuário
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



// Endpoint para consultar os amigos de um usuário
app.get('/friendships/:userId', (req, res) => {
  const userId = req.params.userId; 

  connection.query(`
    SELECT u.user_id, u.username
    FROM Users u
    INNER JOIN Friendships f ON u.user_id = f.friend_id
    WHERE f.user_id = ? AND f.is_accepted = TRUE
    UNION
    SELECT u.user_id, u.username
    FROM Users u
    INNER JOIN Friendships f ON u.user_id = f.user_id
    WHERE f.friend_id = ? AND f.is_accepted = TRUE
  `, [userId, userId], (err, friendResults) => {
    if (err) {
      console.error('Erro ao obter os amigos do usuário:', err);
      res.status(500).send('Erro ao obter os amigos do usuário');
    } else {
      res.status(200).json({ friends: friendResults });
    }
  });
});



app.post('/create-group', (req, res) => {
  const { group_name, user_id, members } = req.body;

  // Verificar se o user_id existe na tabela Users
  connection.query('SELECT * FROM Users WHERE user_id = ?', [user_id], (err, userResults) => {
    if (err) {
      console.error('Erro ao verificar o user_id:', err);
      res.status(500).send('Erro ao verificar o user_id');
      return;
    }
    if (userResults.length === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }

    // Inserir dados na tabela PaymentSession
    connection.query('INSERT INTO PaymentSession (nome, creator_id) VALUES (?, ?)', [group_name, user_id], (err, insertResult) => {
      if (err) {
        console.error('Erro ao inserir novo grupo:', err);
        res.status(500).send('Erro ao criar novo grupo');
        return;
      }
      const groupId = insertResult.insertId;

      // Array para armazenar os valores dos placeholders para a inserção em lote
      const memberValues = members.map(memberId => [groupId, memberId, memberId === user_id ? 1 : 0, 0]);

      // Inserir dados na tabela Session_Members
      connection.query('INSERT INTO Session_Members (session_id, user_id, permission, is_paid) VALUES ?', [memberValues], (err, insertMembersResult) => {
        if (err) {
          console.error('Erro ao inserir membros na sessão:', err);
          res.status(500).send('Erro ao adicionar membros à sessão');
          return;
        }
        res.status(201).json({
          message: 'Grupo criado com sucesso',
          group: {
            group_id: groupId,
            group_name: group_name,
            creator_id: user_id
          }
        });
      });
    });
  });
});


app.get('/viewgroups/:userId', (req, res) => {
  const userId = req.params.userId;

  connection.query(`
    SELECT ps.session_id, ps.nome AS session_name
    FROM Session_Members sm
    INNER JOIN PaymentSession ps ON sm.session_id = ps.session_id
    WHERE sm.user_id = ?
  `, [userId], (err, groupResults) => {
    if (err) {
      console.error('Erro ao obter os grupos do usuário:', err);
      res.status(500).send('Erro ao obter os grupos do usuário');
      return;
    }
    if (groupResults.length === 0) {
      res.status(404).send('Nenhum grupo encontrado para este usuário');
      return;
    }
    res.status(200).json({ groups: groupResults });
  });
});

// Endpoint para obter todas as informações de um grupo específico
app.get('/groupinfo/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;

  const groupInfoQuery = `
    SELECT ps.session_id, ps.nome AS session_name, ps.creator_id
    FROM PaymentSession ps
    WHERE ps.session_id = ?
  `;

  const sessionItemsQuery = `
    SELECT si.item_id, si.name, si.description, si.total_price, si.creation_date
    FROM Session_Items si
    WHERE si.session_id = ?
  `;

  const sessionMembersQuery = `
    SELECT sm.member_id, sm.user_id, sm.permission, sm.is_paid, u.username
    FROM Session_Members sm
    INNER JOIN Users u ON sm.user_id = u.user_id
    WHERE sm.session_id = ?
  `;

  const itemShareQuery = `
    SELECT ish.share_id, ish.item_id, ish.user_id, ish.share_price, u.username
    FROM Item_Share ish
    INNER JOIN Users u ON ish.user_id = u.user_id
    WHERE ish.item_id IN (SELECT item_id FROM Session_Items WHERE session_id = ?)
  `;

  connection.query(groupInfoQuery, [sessionId], (err, groupInfoResults) => {
    if (err) {
      console.error('Erro ao obter informações do grupo:', err);
      res.status(500).send('Erro ao obter informações do grupo');
      return;
    }

    if (groupInfoResults.length === 0) {
      res.status(404).send('Grupo não encontrado');
      return;
    }

    const groupInfo = groupInfoResults[0];

    connection.query(sessionItemsQuery, [sessionId], (err, sessionItemsResults) => {
      if (err) {
        console.error('Erro ao obter itens da sessão:', err);
        res.status(500).send('Erro ao obter itens da sessão');
        return;
      }

      connection.query(sessionMembersQuery, [sessionId], (err, sessionMembersResults) => {
        if (err) {
          console.error('Erro ao obter membros da sessão:', err);
          res.status(500).send('Erro ao obter membros da sessão');
          return;
        }

        connection.query(itemShareQuery, [sessionId], (err, itemShareResults) => {
          if (err) {
            console.error('Erro ao obter compartilhamentos dos itens:', err);
            res.status(500).send('Erro ao obter compartilhamentos dos itens');
            return;
          }

          res.status(200).json({
            group: groupInfo,
            items: sessionItemsResults,
            members: sessionMembersResults,
            itemShares: itemShareResults
          });
        });
      });
    });
  });
});



// Endpoint para adicionar um novo item à sessão
app.post('/add-item', (req, res) => {
  const { session_id, name, description, total_price, selectedMemberIds } = req.body;
  const creation_date = new Date().toISOString().slice(0, 19).replace('T', ' '); // Data e hora atuais

  // Inserir dados na tabela Session_Items
  connection.query('INSERT INTO Session_Items (session_id, name, description, total_price, creation_date) VALUES (?, ?, ?, ?, ?)',
    [session_id, name, description, total_price, creation_date], (err, insertItemResult) => {
      if (err) {
        console.error('Erro ao inserir novo item na sessão:', err);
        res.status(500).send('Erro ao adicionar novo item');
        return;
      }

      const itemId = insertItemResult.insertId;

      // Calcular share_price baseado no número de membros selecionados
      const sharePrice = parseFloat(total_price) / selectedMemberIds.length;

      // Array para armazenar os valores dos placeholders para a inserção em lote
      const itemShareValues = selectedMemberIds.map(memberId => [itemId, memberId, sharePrice]);

      // Inserir dados na tabela Item_Share
      connection.query('INSERT INTO Item_Share (item_id, user_id, share_price) VALUES ?', [itemShareValues], (err, insertShareResult) => {
        if (err) {
          console.error('Erro ao inserir compartilhamento de item:', err);
          res.status(500).send('Erro ao adicionar compartilhamento de item');
          return;
        }

        res.status(201).json({
          message: 'Item adicionado com sucesso à sessão',
          item: {
            item_id: itemId,
            session_id: session_id,
            name: name,
            description: description,
            total_price: total_price,
            creation_date: creation_date,
            share_price: sharePrice
          }
        });
      });
    });
});



// Endpoint para modificar o is_paid de um item na sessão
app.put('/mark-item-paid', (req, res) => {
  const { item_id, user_id } = req.body;

  // Verificar se o item pertence ao usuário
  connection.query('SELECT * FROM Session_Items WHERE item_id = ? AND user_id = ?', [item_id, user_id], (err, itemResults) => {
    if (err) {
      console.error('Erro ao verificar o item:', err);
      res.status(500).send('Erro ao verificar o item');
      return;
    }
    if (itemResults.length === 0) {
      res.status(404).send('Item não encontrado para este usuário');
      return;
    }

    // Atualizar o is_paid para 1
    connection.query('UPDATE Session_Items SET is_paid = 1 WHERE item_id = ? AND user_id = ?', [item_id, user_id], (err, updateResult) => {
      if (err) {
        console.error('Erro ao marcar o item como pago:', err);
        res.status(500).send('Erro ao marcar o item como pago');
        return;
      }

      res.status(200).json({
        message: 'Item marcado como pago com sucesso',
        item_id: item_id,
        user_id: user_id,
        is_paid: 1
      });
    });
  });
});

// Endpoint para marcar um usuário como tendo pago uma sessão
app.put('/final-pay', (req, res) => {
  const { session_id, user_id } = req.body;

  // Verificar se a sessão e o usuário existem na tabela Session_Members
  connection.query('SELECT * FROM Session_Members WHERE session_id = ? AND user_id = ?', [session_id, user_id], (err, memberResults) => {
    if (err) {
      console.error('Erro ao verificar a sessão e o usuário:', err);
      res.status(500).send('Erro ao verificar a sessão e o usuário');
      return;
    }
    if (memberResults.length === 0) {
      res.status(404).send('Usuário ou sessão não encontrado');
      return;
    }

    // Atualizar o is_paid para 1 na tabela Session_Members
    connection.query('UPDATE Session_Members SET is_paid = 1 WHERE session_id = ? AND user_id = ?', [session_id, user_id], (err, updateResult) => {
      if (err) {
        console.error('Erro ao marcar o usuário como pago na sessão:', err);
        res.status(500).send('Erro ao marcar o usuário como pago na sessão');
        return;
      }

      res.status(200).json({
        message: 'Usuário marcado como pago na sessão com sucesso',
        session_id: session_id,
        user_id: user_id,
        is_paid: 1
      });
    });
  });
});

app.put('/accept-friendship', (req, res) => {
  const { user_id, friend_id } = req.body;

  // Verificar se a solicitação de amizade existe e está pendente
  connection.query('SELECT * FROM Friendships WHERE user_id = ? AND friend_id = ? AND is_accepted = 0', [friend_id, user_id], (err, results) => {
    if (err) {
      console.error('Erro ao verificar a solicitação de amizade:', err);
      res.status(500).send('Erro ao aceitar amizade');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Solicitação de amizade não encontrada ou já aceita');
      return;
    }

    // Atualizar a solicitação de amizade para aceita
    connection.query('UPDATE Friendships SET is_accepted = 1 WHERE user_id = ? AND friend_id = ?', [friend_id, user_id], (err, result) => {
      if (err) {
        console.error('Erro ao aceitar a solicitação de amizade:', err);
        res.status(500).send('Erro ao aceitar amizade');
        return;
      }

      res.status(200).json({ message: 'Solicitação de amizade aceita com sucesso' });
    });
  });
});


app.post('/send-friend-request', (req, res) => {
  const { user_id, friend_name, message } = req.body;

  // Verificar se o usuário com o nome fornecido existe
  connection.query('SELECT user_id FROM Users WHERE username = ?', [friend_name], (err, friendResults) => {
    if (err) {
      console.error('Erro ao verificar o nome do usuário:', err);
      res.status(500).send('Erro ao verificar o nome do usuário');
      return;
    }

    if (friendResults.length === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }

    const friend_id = friendResults[0].user_id;

    // Verificar se já existe uma solicitação de amizade entre os usuários
    connection.query('SELECT * FROM Friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', 
      [user_id, friend_id, friend_id, user_id], (err, existingFriendship) => {
      if (err) {
        console.error('Erro ao verificar amizade existente:', err);
        res.status(500).send('Erro ao verificar amizade existente');
        return;
      }

      if (existingFriendship.length > 0) {
        res.status(400).send('Já existe uma solicitação de amizade pendente ou os usuários já são amigos');
        return;
      }

      // Inserir novo registro na tabela Friendships
      connection.query('INSERT INTO Friendships (user_id, friend_id, is_accepted, Message) VALUES (?, ?, 0, ?)', 
        [user_id, friend_id, message], (err, insertResult) => {
        if (err) {
          console.error('Erro ao enviar solicitação de amizade:', err);
          res.status(500).send('Erro ao enviar solicitação de amizade');
          return;
        }

        res.status(201).json({
          message: 'Solicitação de amizade enviada com sucesso',
          friendship: {
            user_id: user_id,
            friend_id: friend_id,
            is_accepted: 0,
            message: message
          }
        });
      });
    });
  });
});


app.get('/userbyname/:username', (req, res) => {
  const username = req.params.username;

  connection.query('SELECT user_id FROM Users WHERE username = ?', [username], (err, results) => {
    if (err) {
      console.error('Erro ao obter o user_id:', err);
      res.status(500).send('Erro ao obter o user_id');
      return;
    }

    if (results.length === 0) {
      res.status(404).send('Usuário não encontrado');
      return;
    }

    const userId = results[0].user_id;
    res.status(200).json({ user_id: userId });
  });
});





app.listen(4000, () => {
  console.log('API está sendo executada na porta 4000');
});
