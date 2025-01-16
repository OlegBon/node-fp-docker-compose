import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import config from './config/config.js';
import { User } from './models/index.js';
import sequelize from './config/db.js';

// Завантаження змінних оточення з .env
dotenv.config();

const app = express();
const port = process.env.APP_PORT || 5000;

// Middleware для обробки JSON-запитів
app.use(express.json()); 

// Налаштування CORS для роботи з фронтендом
app.use(cors({
  origin: 'http://localhost:3000', // URL вашого фронтенду
  credentials: true, // Дозвіл передавати куки між сервером і клієнтом
}));

// Налаштування сесій для збереження авторизації користувачів
app.use(session({
  secret: process.env.SESSION_SECRET || 'my_secret_key', // Секретний ключ для сесій
  resave: false, // Заборона перезаписувати сесію без змін
  saveUninitialized: true, // Збереження неініціалізованих сесій
  cookie: { 
    secure: false, // Використовується HTTP, а не HTTPS
    httpOnly: true, // Заборона доступу до куки через JavaScript
    maxAge: 24 * 60 * 60 * 1000, // Час життя куки: 24 години
    sameSite: 'strict', // Додано атрибут SameSite
  },
}));

// Синхронізація моделі з базою даних
sequelize.sync({ alter: true })
  .then(() => console.log('Моделі синхронізовані з базою даних'))
  .catch((error) => console.error('Помилка синхронізації:', error));

// Маршрут для реєстрації нового користувача
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Перевірка наявності обов'язкових полів
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Всі поля є обов\'язковими' });
    }

    const hashedPassword = await bcrypt.hash(password, 10); // Хешування паролю
    const [users] = await db.execute('SELECT * FROM users WHERE email = ? OR name = ?', [email, name]);

    if (users.length > 0) {
      return res.status(400).json({ error: 'Користувач вже існує' });
    }

    // Додавання нового користувача до бази даних
    await db.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashedPassword]);
    req.session.user = { name, email }; // Збереження даних користувача в сесії
    res.status(201).json({ message: 'Користувача зареєстровано' });
  } catch (error) {
    console.error('Помилка під час реєстрації:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Маршрут для входу користувача
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'Користувач не знайдений' });
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password); // Перевірка паролю

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Невірний пароль' });
    }

    req.session.user = { id: user.id, name: user.name, email: user.email }; // Збереження авторизації
    res.json({ message: 'Успішний вхід' });
  } catch (error) {
    console.error('Помилка під час входу:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Маршрут для перевірки активної сесії
app.get('/session', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Користувач не авторизований' });
  }
  res.json(req.session.user);
});

// Маршрут для виходу користувача
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Помилка під час виходу:', err);
      return res.status(500).json({ error: 'Помилка сервера' });
    }
    res.json({ message: 'Вихід виконано' });
  });
});

// Маршрут для очищення бази даних
app.post('/clear', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Користувач не авторизований' });
    }
    await db.execute('DELETE FROM users'); // Видалення всіх записів з таблиці
    res.json({ message: 'Базу даних очищено' });
  } catch (error) {
    console.error('Помилка очищення бази даних:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Маршрут для отримання всіх користувачів
app.get('/users', async (req, res) => {
  try {
    const users = await User.findAll(); // Використання Sequelize для отримання всіх користувачів
    res.json(users);
  } catch (error) {
    console.error('Помилка отримання користувачів:', error);
    res.status(500).json({ error: 'Внутрішня помилка сервера' });
  }
});

// Обробка помилок для неіснуючих маршрутів
app.use((req, res) => {
  res.status(404).json({ error: 'Сторінка не знайдена' });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер працює на порту ${port}`);
});
