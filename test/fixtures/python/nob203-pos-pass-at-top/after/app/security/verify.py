def verify_token(token):
    pass
    if not token.valid:
        raise Unauthorized()
