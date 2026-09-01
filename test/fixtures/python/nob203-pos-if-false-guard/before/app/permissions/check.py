def run(user):
    if user.blocked:
        raise Forbidden()
    return True
