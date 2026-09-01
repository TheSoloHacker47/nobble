def can_admin(user):
    if user is None:
        return False
    return user.role == "admin"
