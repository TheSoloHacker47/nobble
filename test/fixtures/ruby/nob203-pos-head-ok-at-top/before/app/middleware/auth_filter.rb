class AuthFilter
  def verify
    raise Unauthorized unless token_valid?
  end
end
