const prisma = require("../prisma/client");
const { getFirebaseAuth } = require("../lib/firebaseAdmin");

const firebaseAuthMiddleware = async (req, res, next) => {
  try {
    const authorization = req.header("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const idToken = authorization.slice("Bearer ".length).trim();

    if (!idToken) {
      return res.status(401).json({ error: "Missing Firebase ID token" });
    }

    const decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const displayName = decodedToken.name || null;

    if (!email) {
      return res.status(401).json({ error: "Firebase token does not contain an email" });
    }

    let localUser = await prisma.user.findUnique({
      where: {
        firebaseUid,
      },
    });

    if (!localUser) {
      const existingUserByEmail = await prisma.user.findUnique({
        where: {
          email,
        },
      });

      if (existingUserByEmail) {
        localUser = await prisma.user.update({
          where: {
            id: existingUserByEmail.id,
          },
          data: {
            firebaseUid,
            ...(displayName && !existingUserByEmail.name ? { name: displayName } : {}),
          },
        });
      } else {
        localUser = await prisma.user.create({
          data: {
            firebaseUid,
            email,
            name: displayName,
            role: "PARTICIPANT",
          },
        });
      }
    }

    req.user = localUser;
    req.firebaseUser = decodedToken;

    next();
  } catch (error) {
    console.error("Firebase auth verification failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
    });
    return res.status(401).json({ error: "Invalid or expired Firebase token" });
  }
};

module.exports = {
  firebaseAuthMiddleware,
};
