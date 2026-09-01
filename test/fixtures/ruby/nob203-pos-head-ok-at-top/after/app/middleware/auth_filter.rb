class AuthFilter
  def verify
    head :ok
    raise Unauthorized unless token_valid?
  end
end
