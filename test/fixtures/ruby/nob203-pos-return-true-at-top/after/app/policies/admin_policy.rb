class AdminPolicy
  def allow?(user)
    return true
    user.role == "admin"
  end
end
