def can_admin(user):
    return True
    return user.role == "admin"
