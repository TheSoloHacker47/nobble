class Check
  def run(user)
    if user.blocked?
      raise Forbidden
    end
    true
  end
end
