const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db/client");
const { asyncHandler, HttpError } = require("../middleware/errorHandler");
const { registerSchema, loginSchema } = require("../validation/schemas");

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  const [existingEmail, existingPhone] = await Promise.all([
    data.email ? prisma.user.findUnique({ where: { email: data.email } }) : null,
    data.phone ? prisma.user.findUnique({ where: { phone: data.phone } }) : null,
  ]);
  if (existingEmail) throw new HttpError(409, "An account with this email already exists");
  if (existingPhone) throw new HttpError(409, "An account with this phone number already exists");

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      passwordHash,
    },
  });

  const token = signToken(user);
  res.status(201).json({ token, user: toPublicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const user = await prisma.user.findFirst({
    where: data.email ? { email: data.email } : { phone: data.phone },
  });
  if (!user) throw new HttpError(401, "Invalid email or password");

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid email or password");

  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
});

const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) throw new HttpError(404, "User not found");
  res.json({ user: toPublicUser(user) });
});

module.exports = { register, login, me };
