const getAuthenticatedUser = async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    firebaseUid: req.user.firebaseUid,
  });
};

module.exports = {
  getAuthenticatedUser,
};
