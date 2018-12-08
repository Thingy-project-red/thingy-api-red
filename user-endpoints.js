const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongo = require('./mongo.js');
const prefs = require('./user-thresholds.js');

const userRights = ['api', 'admin'];


async function getUsers(ctx) {
  // Get MongoDB connection
  const users = await mongo();

  const userObjects = await users.find(
    {}, { fields: { _id: 0, hash: 0 } }
  ).toArray();
  ctx.body = userObjects;
}

async function addUser(ctx) {
  // Get MongoDB connection
  const users = await mongo();

  // Check if request contains the required information
  if (!['name', 'password', 'rights'].every(x => x in ctx.request.body)) {
    ctx.throw(400, 'Missing attributes');
  }
  // Obtain name, password & rights
  const { name, password, rights } = ctx.request.body;
  // Make sure rights are valid
  if (!rights.every(x => userRights.includes(x))) {
    ctx.throw(400, 'Invalid user rights');
  }
  // Check if user doesn't exist yet
  if ((await users.find({ name }).toArray()).length !== 0) {
    ctx.throw(400, 'User exists already');
  }

  // Compute salted hash (10 salt rounds)
  const hash = await bcrypt.hash(password, 10);
  // Store user
  await users.insertOne({ name, rights, hash });

  // Return representation of created user (without password hash)
  ctx.body = { name, rights };
  prefs.update();
}

async function deleteUser(ctx) {
  // Get MongoDB connection
  const users = await mongo();

  if ((await users.deleteOne({ name: ctx.params.user })).deletedCount !== 1) {
    ctx.throw(404, 'User doesn\'t exist');
  }
  ctx.status = 204;
  prefs.update();
}

async function getUser(ctx) {
  const users = await mongo();
  const name = ctx.params.user;

  // Only users with admin right can see other users data
  if (ctx.state.user.sub !== name
    && !ctx.state.user.rights.includes('admin')) {
    ctx.throw(401);
  }

  const user = await users.findOne({ name }, { fields: { _id: 0, hash: 0 } });
  if (user == null) {
    ctx.throw(404, 'User doesn\'t exist');
  }
  ctx.body = user;
}

async function updateUser(ctx, users) {
  const data = ctx.request.body;
  const name = ctx.params.user;

  if ('hash' in data) {
    ctx.throw(400);
  }

  if ((await users.updateOne({ name }, { $set: data })).matchedCount !== 1) {
    ctx.throw(404, 'User doesn\'t exist');
  }
  ctx.status = 204;
  prefs.update();
}

async function updateUserData(ctx) {
  const users = await mongo();
  const data = ctx.request.body;

  // Make sure user has all required rights
  // Admin rights: modify name or rights
  // API rights: modify preferences
  if ('preferences' in data && !ctx.state.user.rights.includes('api')) {
    ctx.throw(401);
  }

  await updateUser(ctx, users);
}

async function updateUserPrefs(ctx) {
  const users = await mongo();
  const data = ctx.request.body;

  // Make sure user has all required rights
  // Admin rights: modify name or rights
  // API rights: modify preferences
  if (('rights' in data || 'name' in data)
    && !ctx.state.user.rights.includes('admin')) {
    ctx.throw(401);
  }

  await updateUser(ctx, users);
}

async function authenticate(ctx) {
  // Get MongoDB connection
  const users = await mongo();

  // Check if name and password were submitted
  if (!('name' in ctx.request.body && 'password' in ctx.request.body)) {
    ctx.throw(400, 'User\'s name and password required');
  }
  // Obtain name and password
  const { name, password } = ctx.request.body;
  let user;
  if (name === process.env.USERS_ADMIN_NAME) {
    // This is the artificial admin user
    if (password !== process.env.USERS_ADMIN_PASSWORD) {
      ctx.throw(401, 'Wrong password');
    }
    // Since the user doesn't exist, we need to build it
    user = {
      name,
      rights: ['api', 'admin']
    };
  } else {
    // Fetch user from DB
    const results = await users.find({ name }).toArray();
    // Check if user exists
    if (results.length === 0) {
      ctx.throw(401, 'User doesn\'t exist');
    }
    // If so, get user
    [user] = results;

    // Compare password with salted hash
    if (!(await bcrypt.compare(password, user.hash))) {
      ctx.throw(401, 'Wrong password');
    }
  }

  // Prepare JWT signing
  const signOptions = {
    issuer: 'thingy-api-red',
    subject: user.name,
    expiresIn: '1d'
  };
  // Generate JWT with user's rights
  const token = await jwt.sign(
    { rights: user.rights },
    process.env.JWT_SECRET,
    signOptions
  );

  ctx.body = token;
}

module.exports = {
  getUsers,
  getUser,
  addUser,
  updateUserData,
  updateUserPrefs,
  deleteUser,
  authenticate
};
