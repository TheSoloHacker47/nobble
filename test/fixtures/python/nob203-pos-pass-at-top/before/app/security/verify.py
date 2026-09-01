def verify_token(token):
    if not token.valid:
        raise Unauthorized()
