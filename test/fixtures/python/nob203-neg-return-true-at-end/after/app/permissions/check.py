def can_admin(user):
    if user is None:
        return False
    if user.role != "admin":
        return False
    return True
