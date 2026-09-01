def charge():
    try:
        return do_charge()
    except ValueError as e:
        raise ChargeError from e
