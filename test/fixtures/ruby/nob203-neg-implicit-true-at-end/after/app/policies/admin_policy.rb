class AdminPolicy
  def allow?(user)
    return false if user.nil?
    return false unless user.role == "admin"
    true
  end
end
